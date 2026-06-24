-- user_wallets
create table user_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wallet_address text not null unique,
  encrypted_private_key text not null,
  key_encryption_version int not null default 1,
  created_at timestamptz not null default now()
);

comment on table user_wallets is 'One GenLayer-compatible wallet per user, generated server-side on signup. Private key is envelope-encrypted; only ever decrypted inside Edge Functions.';
comment on column user_wallets.encrypted_private_key is 'Ciphertext + nonce + encrypted DEK (AES-256-GCM), encrypted with WALLET_KEK. Never selectable from the client.';

-- Public view exposing only the wallet address, safe for client-side reads.
create view user_wallets_public as
  select user_id, wallet_address, created_at
  from user_wallets;

comment on view user_wallets_public is 'Client-safe view of user_wallets; excludes encrypted_private_key and key_encryption_version.';
