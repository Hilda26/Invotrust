-- vendors
create table vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  tax_id text,
  email text,
  bank_account_hash text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint vendors_status_check check (status in ('active', 'under_review', 'blocked')),
  constraint vendors_org_tax_id_unique unique (org_id, tax_id)
);

create index vendors_org_id_idx on vendors (org_id);

comment on column vendors.bank_account_hash is 'Hashed bank account identifier, used for duplicate/fraud detection without storing raw bank data.';

-- vendor_reputation
create table vendor_reputation (
  vendor_id uuid primary key references vendors (id) on delete cascade,
  reputation_score numeric not null default 50,
  total_invoices int not null default 0,
  flagged_invoices int not null default 0,
  avg_price_variance_pct numeric not null default 0,
  last_updated timestamptz not null default now()
);

comment on table vendor_reputation is 'Recalculated after each invoice decision; reputation_score is 0-100.';
