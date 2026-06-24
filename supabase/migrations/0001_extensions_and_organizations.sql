-- Extensions
create extension if not exists pgcrypto;

-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'trial',
  risk_threshold numeric not null default 70,
  procurement_policy text,
  created_at timestamptz not null default now()
);

comment on table organizations is 'Tenant root. Every other tenant table references org_id back to this.';
comment on column organizations.plan is 'trial / pro / enterprise';
comment on column organizations.risk_threshold is 'Preliminary risk score (0-100) at or above which invoices auto-submit to GenLayer.';
