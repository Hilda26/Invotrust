-- genlayer_validations
create table genlayer_validations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  contract_address text not null,
  tx_hash text,
  status text not null default 'pending',
  consensus_result jsonb,
  risk_factors jsonb,
  reasoning text,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint genlayer_validations_status_check check (status in ('pending', 'approved', 'rejected', 'escalated', 'failed'))
);

create index genlayer_validations_invoice_id_idx on genlayer_validations (invoice_id);

comment on table genlayer_validations is 'One row per submission attempt to the InvoiceValidator Intelligent Contract (re-submissions on escalation create new rows).';
comment on column genlayer_validations.risk_factors is 'Structured list of {factor, weight, detail} from the validator consensus.';
comment on column genlayer_validations.reasoning is 'Explainable narrative produced by the validator consensus.';
