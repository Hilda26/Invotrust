-- Add org_id, decision, risk_score, and confirmed_at to genlayer_validations
-- so the sync-genlayer-result function can upsert by (invoice_id, org_id).
alter table genlayer_validations
  add column if not exists org_id uuid references organizations (id) on delete cascade,
  add column if not exists decision text,
  add column if not exists risk_score int,
  add column if not exists confirmed_at timestamptz;

-- Make contract_address nullable - it is set later when known
alter table genlayer_validations
  alter column contract_address drop not null;

-- Add "confirmed" as a valid status (replaces individual decision values in status column)
alter table genlayer_validations
  drop constraint if exists genlayer_validations_status_check;

alter table genlayer_validations
  add constraint genlayer_validations_status_check
  check (status in ('pending', 'confirmed', 'failed'));

-- Add constraint so we can upsert by (invoice_id, org_id)
alter table genlayer_validations
  drop constraint if exists genlayer_validations_invoice_org_unique;

alter table genlayer_validations
  add constraint genlayer_validations_invoice_org_unique
  unique (invoice_id, org_id);

-- Add org_id index for lookup
create index if not exists genlayer_validations_org_id_idx on genlayer_validations (org_id);

-- Add decision constraint
alter table genlayer_validations
  drop constraint if exists genlayer_validations_decision_check;

alter table genlayer_validations
  add constraint genlayer_validations_decision_check
  check (decision is null or decision in ('approved', 'rejected', 'escalated'));

-- Add submitted_to_genlayer as valid invoice status
alter table invoices
  drop constraint if exists invoices_status_check;

alter table invoices
  add constraint invoices_status_check
  check (status in ('pending', 'submitted_to_genlayer', 'approved', 'rejected', 'escalated'));

-- Add procurement_policy to organizations (referenced in GenLayer contract payload)
alter table organizations
  add column if not exists procurement_policy text;

-- Add total_amount to vendor_reputation for accurate rolling average calculations
alter table vendor_reputation
  add column if not exists total_amount numeric not null default 0,
  add column if not exists org_id uuid references organizations (id) on delete cascade;

-- upsert_vendor_reputation: atomically update rolling stats after a GenLayer decision
create or replace function upsert_vendor_reputation(
  p_vendor_id uuid,
  p_org_id uuid,
  p_flagged boolean,
  p_price_variance_pct numeric
)
returns void
language plpgsql
security definer
as $$
begin
  insert into vendor_reputation (
    vendor_id,
    org_id,
    total_invoices,
    flagged_invoices,
    avg_price_variance_pct,
    total_amount,
    reputation_score,
    last_updated
  )
  values (
    p_vendor_id,
    p_org_id,
    1,
    case when p_flagged then 1 else 0 end,
    p_price_variance_pct,
    0,
    case when p_flagged then 40 else 60 end,
    now()
  )
  on conflict (vendor_id)
  do update set
    total_invoices = vendor_reputation.total_invoices + 1,
    flagged_invoices = vendor_reputation.flagged_invoices + case when p_flagged then 1 else 0 end,
    avg_price_variance_pct = (
      (vendor_reputation.avg_price_variance_pct * vendor_reputation.total_invoices + p_price_variance_pct)
      / (vendor_reputation.total_invoices + 1)
    ),
    reputation_score = greatest(
      0,
      least(
        100,
        100 - (
          (vendor_reputation.flagged_invoices + case when p_flagged then 1 else 0 end)::numeric
          / (vendor_reputation.total_invoices + 1)
          * 80
        )
      )
    ),
    last_updated = now();
end;
$$;

grant execute on function upsert_vendor_reputation(uuid, uuid, boolean, numeric) to service_role;
