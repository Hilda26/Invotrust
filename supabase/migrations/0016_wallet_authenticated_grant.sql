-- Grant authenticated users SELECT on user_wallets so that the
-- user_wallets_public view (security_invoker = on) can access the
-- underlying table when called by an authenticated client.
-- The column-level revoke in 0011 already blocks encrypted_private_key
-- and key_encryption_version, so only wallet_address and metadata
-- are readable by authenticated clients via the view.
grant select on table public.user_wallets to authenticated;
