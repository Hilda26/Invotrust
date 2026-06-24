-- The on-signup-wallet Edge Function uses the service_role key to insert and
-- read wallet rows. With auto_expose_new_tables disabled, new tables are not
-- automatically granted to the Data API roles, so grant the privileges the
-- service role needs explicitly. RLS remains enabled, but service_role
-- bypasses RLS by default while still requiring the underlying table grants.

grant select, insert, update on table public.user_wallets to service_role;
