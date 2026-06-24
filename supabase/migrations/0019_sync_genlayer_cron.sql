-- Enable pg_cron extension (requires superuser; Supabase provisions this)
create extension if not exists pg_cron with schema pg_catalog;

-- Grant usage on cron schema to postgres role
grant usage on schema cron to postgres;

-- Schedule sync-genlayer-result to poll pending GenLayer validations every 2 minutes.
-- Sends x-supabase-internal: 1 so the Edge Function recognises this as a cron caller
-- and bypasses user-session auth. The function uses the service_role key internally.
select cron.schedule(
  'sync-genlayer-result',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://zhztgamyniqnzncmopei.supabase.co/functions/v1/sync-genlayer-result',
    headers := '{"Content-Type": "application/json", "x-supabase-internal": "1"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
