-- Helper functions used by RLS policies. SECURITY DEFINER avoids recursive RLS
-- evaluation when policies on organization_members would otherwise reference
-- organization_members itself.

create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from organization_members
    where org_id = p_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from organization_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

-- Atomically creates an organization and makes the calling user its owner.
-- This is the only supported way to create an organization from the client;
-- direct inserts into organizations/organization_members are blocked by RLS.
create or replace function create_organization_with_owner(p_name text, p_slug text)
returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org organizations;
begin
  insert into organizations (name, slug)
  values (p_name, p_slug)
  returning * into v_org;

  insert into organization_members (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  return v_org;
end;
$$;

revoke all on function create_organization_with_owner(text, text) from public;
grant execute on function create_organization_with_owner(text, text) to authenticated;
