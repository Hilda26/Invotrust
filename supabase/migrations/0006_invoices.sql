-- invoices
create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  vendor_id uuid not null references vendors (id) on delete cascade,
  po_id uuid references purchase_orders (id) on delete set null,
  invoice_number text not null,
  amount numeric not null,
  currency text not null default 'USD',
  issue_date date,
  due_date date,
  file_path text,
  file_hash text,
  status text not null default 'pending',
  preliminary_risk_score numeric,
  final_risk_score numeric,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoices_status_check check (status in ('pending', 'under_review', 'approved', 'rejected', 'escalated')),
  constraint invoices_org_vendor_invoice_number_unique unique (org_id, vendor_id, invoice_number)
);

create index invoices_org_id_status_idx on invoices (org_id, status);
create index invoices_vendor_id_idx on invoices (vendor_id);
create index invoices_org_id_file_hash_idx on invoices (org_id, file_hash);

comment on column invoices.file_hash is 'sha256 of the uploaded document, used for duplicate document detection.';
comment on column invoices.preliminary_risk_score is 'Computed deterministically in the submit-invoice Edge Function.';
comment on column invoices.final_risk_score is 'Populated from GenLayer consensus once validation resolves.';

-- invoice_line_items
create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  description text,
  quantity numeric,
  unit_price numeric,
  total numeric
);

create index invoice_line_items_invoice_id_idx on invoice_line_items (invoice_id);
