-- Returns organization members joined with their auth identity (email, name)
-- and an "active"/"invited" status derived from email confirmation. Used by
-- the members settings page; SECURITY DEFINER is required because clients
-- cannot query auth.users directly.
create or replace function get_organization_members(p_org_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    om.id,
    om.user_id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email::text) as full_name,
    om.role,
    case when u.email_confirmed_at is not null then 'active' else 'invited' end as status,
    om.created_at
  from organization_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = p_org_id
    and is_org_member(p_org_id)
  order by om.created_at asc;
$$;

revoke all on function get_organization_members(uuid) from public;
grant execute on function get_organization_members(uuid) to authenticated;
