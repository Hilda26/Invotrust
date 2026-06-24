# InvoTrust - API Design

Most read/write operations go directly from the Next.js app to Supabase (PostgREST + RLS) using the Supabase client - these are not enumerated individually since they map 1:1 to the tables in `02-database-schema.md` (standard CRUD filtered by `org_id`).

The endpoints below are the **Supabase Edge Functions** that encapsulate privileged or cross-system logic.

---

## `POST /functions/v1/on-signup-wallet`
Triggered server-side (via Supabase Auth webhook / DB trigger) immediately after a new user completes registration.

**Request** (internal, from Auth hook)
```json
{ "user_id": "uuid", "email": "string" }
```

**Behavior**
1. Generate a new keypair (GenLayer-compatible / EVM-style account).
2. Encrypt private key with envelope encryption (see Security Design).
3. Insert into `user_wallets`.
4. Write `audit_logs` entry `wallet.created`.

**Response**
```json
{ "wallet_address": "0x..." }
```

---

## `POST /functions/v1/submit-invoice`
Called from the Invoice Upload page after the file is uploaded to Supabase Storage.

**Request**
```json
{
  "org_id": "uuid",
  "vendor_id": "uuid",
  "po_id": "uuid|null",
  "invoice_number": "string",
  "amount": 1234.56,
  "currency": "USD",
  "issue_date": "2026-06-01",
  "due_date": "2026-06-30",
  "file_path": "storage/path.pdf",
  "line_items": [{ "description": "string", "quantity": 1, "unit_price": 100, "total": 100 }]
}
```

**Behavior**
1. Compute `file_hash`; check `invoices(org_id, file_hash)` for duplicates.
2. Check `invoices(org_id, vendor_id, invoice_number)` uniqueness.
3. Match against `po_id` line items if provided -> `po_match_flag`, variance.
4. Compute `price_variance_pct` vs vendor historical averages (`vendor_reputation`).
5. Check payment timing vs vendor's historical due-date pattern -> `payment_timing_flag`.
6. Compute `preliminary_risk_score` (weighted sum of flags).
7. Insert `invoices`, `invoice_line_items`, `invoice_analysis`.
8. If `preliminary_risk_score >= organizations.risk_threshold`, asynchronously invoke `submit-to-genlayer`.
9. Write `audit_logs` entry `invoice.submitted`.

**Response**
```json
{
  "invoice_id": "uuid",
  "preliminary_risk_score": 72,
  "anomaly_flags": [{ "type": "price_variance", "severity": "high", "detail": "23% above vendor average" }],
  "genlayer_submission": "queued|skipped"
}
```

---

## `POST /functions/v1/submit-to-genlayer`
Submits (or re-submits) an invoice to the `InvoiceValidator` Intelligent Contract.

**Request**
```json
{ "invoice_id": "uuid" }
```

**Behavior**
1. Load invoice, vendor history, PO match data, `invoice_analysis`.
2. Load the organization wallet (`user_wallets` of the org owner, or a dedicated org wallet - see Security Design open item).
3. Build the GenLayer transaction payload (invoice metadata, vendor reputation, deterministic flags) and call `submit_invoice()` on the contract via GenLayer JS SDK (StudioNet, GEN fees).
4. Insert `genlayer_validations` row with `status = 'pending'`, store `tx_hash`.
5. Write `audit_logs` entry `genlayer.submitted`.

**Response**
```json
{ "genlayer_validation_id": "uuid", "tx_hash": "0x...", "status": "pending" }
```

---

## `POST /functions/v1/sync-genlayer-result`
Polled by a scheduled Edge Function (cron) or invoked on-demand from the Risk Analysis page ("Check status").

**Request**
```json
{ "genlayer_validation_id": "uuid" }
```

**Behavior**
1. Call `get_validation_result()` on the contract for the stored `tx_hash` / invoice id.
2. If resolved: update `genlayer_validations` (`status`, `consensus_result`, `risk_factors`, `reasoning`, `resolved_at`).
3. Update `invoices.final_risk_score` and `invoices.status` based on consensus decision (Approved/Rejected/Escalated).
4. Update `vendor_reputation` (increment counters, recompute `reputation_score`).
5. Write `audit_logs` entry `genlayer.consensus_received`.

**Response**
```json
{
  "status": "approved",
  "final_risk_score": 81,
  "reasoning": "string",
  "risk_factors": [{ "factor": "vendor_credibility", "weight": 0.3, "detail": "string" }]
}
```

---

## `POST /functions/v1/export-private-key`
Allows a user to securely export their wallet private key.

**Request**
```json
{ "reauth_token": "string" }
```

**Behavior**
1. Verify `reauth_token` (fresh password confirmation / step-up auth).
2. Decrypt `encrypted_private_key` using envelope key.
3. Write `audit_logs` entry `wallet.key_exported` (without the key itself).
4. Return the key once; never cache or log it.

**Response**
```json
{ "private_key": "0x...", "wallet_address": "0x..." }
```

---

## Error Format (all functions)
```json
{ "error": { "code": "string", "message": "string" } }
```
Standard codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_INVOICE`, `GENLAYER_ERROR`, `VALIDATION_ERROR`.
