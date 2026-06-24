-- Automatically provisions a wallet for every new auth user by invoking the
-- on-signup-wallet Edge Function via pg_net whenever a row is inserted into
-- auth.users. The shared webhook secret is stored in Supabase Vault so it
-- never appears in plain text in the database or migration history.

create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  '6feec520d34c2a8af8ba892f0c63372c2a68fb98248502bbb91aa74fef70ff80',
  'on_signup_wallet_webhook_secret',
  'Shared secret for authenticating calls from the auth.users trigger to the on-signup-wallet Edge Function'
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
  function_url text := 'https://zhztgamyniqnzncmopei.functions.supabase.co/on-signup-wallet';
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'on_signup_wallet_webhook_secret';

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'users',
      'schema', 'auth',
      'record', jsonb_build_object('id', new.id)
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
