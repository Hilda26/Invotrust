-- invoice_analysis
create table invoice_analysis (
  invoice_id uuid primary key references invoices (id) on delete cascade,
  duplicate_flag boolean not null default false,
  po_match_flag boolean not null default false,
  price_variance_pct numeric,
  payment_timing_flag boolean not null default false,
  anomaly_flags jsonb not null default '[]',
  preliminary_explanation text,
  created_at timestamptz not null default now()
);

comment on table invoice_analysis is 'Results of deterministic pre-checks run by the submit-invoice Edge Function, prior to any GenLayer submission.';
comment on column invoice_analysis.anomaly_flags is 'Array of {type, severity, detail} objects.';
