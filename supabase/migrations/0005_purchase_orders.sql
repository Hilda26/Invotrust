-- purchase_orders
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  vendor_id uuid not null references vendors (id) on delete cascade,
  po_number text not null,
  total_amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint purchase_orders_status_check check (status in ('open', 'closed', 'cancelled'))
);

create index purchase_orders_org_id_po_number_idx on purchase_orders (org_id, po_number);
create index purchase_orders_vendor_id_idx on purchase_orders (vendor_id);

-- po_line_items
create table po_line_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders (id) on delete cascade,
  description text,
  quantity numeric,
  unit_price numeric
);

create index po_line_items_po_id_idx on po_line_items (po_id);
