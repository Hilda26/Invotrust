-- organization_members
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint organization_members_org_user_unique unique (org_id, user_id),
  constraint organization_members_role_check check (role in ('owner', 'admin', 'finance_reviewer', 'viewer'))
);

create index organization_members_org_id_idx on organization_members (org_id);
create index organization_members_user_id_idx on organization_members (user_id);

comment on table organization_members is 'Maps auth.users to organizations with a role used for RBAC.';
