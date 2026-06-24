# InvoTrust - Database Design (Supabase / Postgres)

## ER Overview

```
organizations 1───* organization_members *───1 auth.users (1───1 user_wallets)
organizations 1───* vendors 1───* vendor_contacts
organizations 1───* purchase_orders 1───* po_line_items
organizations 1───* invoices ──── vendor_id, po_id
invoices 1───* invoice_line_items
invoices 1───1 invoice_analysis
invoices 1───* genlayer_validations
organizations 1───* audit_logs
vendors 1───1 vendor_reputation
```

## Tables

### `organizations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| name | text not null | |
| slug | text unique not null | |
| plan | text default 'trial' | trial/pro/enterprise |
| risk_threshold | numeric default 70 | score above which invoices auto-submit to GenLayer |
| procurement_policy | text nullable | free-text policy passed to the GenLayer contract for compliance checks |
| created_at | timestamptz default now() | |

### `organization_members`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK -> organizations | |
| user_id | uuid FK -> auth.users | |
| role | text not null | owner / admin / finance_reviewer / viewer |
| created_at | timestamptz default now() | |
| unique (org_id, user_id) | | |

### `user_wallets`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK FK -> auth.users | one wallet per user, immutable |
| wallet_address | text unique not null | |
| encrypted_private_key | text not null | envelope-encrypted, see Security Design |
| key_encryption_version | int not null default 1 | for key rotation |
| created_at | timestamptz default now() | |

### `vendors`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK -> organizations | |
| name | text not null | |
| tax_id | text | |
| email | text | |
| bank_account_hash | text | hashed, for duplicate/fraud detection without storing raw bank data |
| status | text default 'active' | active / under_review / blocked |
| created_at | timestamptz default now() | |
| index (org_id) | | |
| unique (org_id, tax_id) | | |

### `vendor_reputation`
| Column | Type | Notes |
|---|---|---|
| vendor_id | uuid PK FK -> vendors | |
| reputation_score | numeric default 50 | 0-100, recalculated after each invoice decision |
| total_invoices | int default 0 | |
| flagged_invoices | int default 0 | |
| avg_price_variance_pct | numeric default 0 | |
| last_updated | timestamptz default now() | |

### `purchase_orders`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK -> organizations | |
| vendor_id | uuid FK -> vendors | |
| po_number | text not null | |
| total_amount | numeric not null | |
| currency | text default 'USD' | |
| status | text default 'open' | open / closed / cancelled |
| created_at | timestamptz default now() | |
| index (org_id, po_number) | | |

### `po_line_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| po_id | uuid FK -> purchase_orders | |
| description | text | |
| quantity | numeric | |
| unit_price | numeric | |

### `invoices`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK -> organizations | |
| vendor_id | uuid FK -> vendors | |
| po_id | uuid FK -> purchase_orders nullable | |
| invoice_number | text not null | |
| amount | numeric not null | |
| currency | text default 'USD' | |
| issue_date | date | |
| due_date | date | |
| file_path | text | Supabase Storage path |
| file_hash | sha256 text | for duplicate detection |
| status | text default 'pending' | pending / under_review / approved / rejected / escalated |
| preliminary_risk_score | numeric | computed in `submit-invoice` Edge Function |
| final_risk_score | numeric nullable | from GenLayer consensus |
| created_by | uuid FK -> auth.users | |
| created_at | timestamptz default now() | |
| index (org_id, status) | | |
| index (vendor_id) | | |
| unique (org_id, vendor_id, invoice_number) | prevents duplicate invoice numbers per vendor |
| index (org_id, file_hash) | duplicate document detection |

### `invoice_line_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK -> invoices | |
| description | text | |
| quantity | numeric | |
| unit_price | numeric | |
| total | numeric | |

### `invoice_analysis`
| Column | Type | Notes |
|---|---|---|
| invoice_id | uuid PK FK -> invoices | |
| duplicate_flag | boolean default false | |
| po_match_flag | boolean default false | true if matched to a PO |
| price_variance_pct | numeric | vs vendor historical avg / PO |
| payment_timing_flag | boolean default false | unusual timing vs vendor pattern |
| anomaly_flags | jsonb default '[]' | array of {type, severity, detail} |
| preliminary_explanation | text | human-readable summary of deterministic checks |
| created_at | timestamptz default now() | |

### `genlayer_validations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK -> invoices | |
| contract_address | text not null | |
| tx_hash | text | submission transaction |
| status | text default 'pending' | pending / approved / rejected / escalated / failed |
| consensus_result | jsonb | raw contract response |
| risk_factors | jsonb | structured list of factors with weights |
| reasoning | text | explainable narrative from validators |
| submitted_at | timestamptz default now() | |
| resolved_at | timestamptz | |
| index (invoice_id) | | |

### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK -> organizations | |
| actor_id | uuid FK -> auth.users nullable | null for system/contract actions |
| action | text not null | e.g. invoice.submitted, invoice.approved, genlayer.consensus_received, wallet.key_exported |
| entity_type | text not null | invoice / vendor / po / wallet / user |
| entity_id | uuid | |
| metadata | jsonb | |
| created_at | timestamptz default now() | |
| index (org_id, created_at desc) | | |
| index (entity_type, entity_id) | | |

## Indexing Strategy Summary
- All tenant tables indexed on `org_id` (and composite with `status`/`created_at` where lists are filtered/sorted).
- `invoices(org_id, file_hash)` and `invoices(org_id, vendor_id, invoice_number)` enforce duplicate-invoice detection at the DB level.
- `audit_logs(org_id, created_at desc)` for fast paginated audit views.
- `genlayer_validations(invoice_id)` for 1:N history of validation attempts (re-submissions on escalation).

## Row Level Security (summary, detailed in Security Design)
- Enable RLS on every table above.
- Standard policy pattern: `org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())`.
- `user_wallets`: row visible only to `user_id = auth.uid()`; private key column never selectable from client (accessed only via Edge Function using service role).
- Write policies restricted by `role` (e.g., only `finance_reviewer`/`admin`/`owner` can update `invoices.status`).
