-- audit_logs
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_entity_type_check check (entity_type in ('invoice', 'vendor', 'po', 'wallet', 'user', 'organization'))
);

create index audit_logs_org_id_created_at_idx on audit_logs (org_id, created_at desc);
create index audit_logs_entity_type_entity_id_idx on audit_logs (entity_type, entity_id);

comment on table audit_logs is 'Append-only audit trail. actor_id is null for system/contract-originated actions (e.g. genlayer.consensus_received).';
comment on column audit_logs.action is 'e.g. invoice.submitted, invoice.approved, genlayer.consensus_received, wallet.key_exported';
