-- service_role previously only had explicit grants on user_wallets
-- (migration 0014). Every other table was missing SELECT/INSERT/UPDATE/
-- DELETE for service_role, which silently broke every Edge Function that
-- uses the service-role client (submit-invoice, submit-to-genlayer,
-- sync-genlayer-result, invite-member, export-private-key, etc.) with
-- "permission denied for table X" errors that looked like application
-- bugs rather than missing grants. This restores Supabase's standard
-- default: service_role has full DML access to every table in the public
-- schema, since it is only ever used server-side inside Edge Functions and
-- never exposed to the browser.

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Apply the same grants automatically to any table created in the future,
-- so this class of bug can't silently recur after the next migration.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
