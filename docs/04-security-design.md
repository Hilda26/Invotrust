# InvoTrust - Security Design

## Authentication
- Supabase Auth, email/password, email verification required before first login.
- Session via Supabase JWT (httpOnly cookies through `@supabase/ssr` in Next.js).
- Step-up re-authentication (password re-entry) required for sensitive actions: private key export, role changes, organization deletion.

## Wallet Generation & Binding
- On successful signup, a Supabase Auth webhook invokes `on-signup-wallet`.
- A new EVM-compatible keypair (compatible with GenLayer's account model) is generated server-side using a CSPRNG inside the Edge Function runtime - never in the browser.
- The private key is **envelope-encrypted** before storage:
  1. Generate a random 256-bit Data Encryption Key (DEK).
  2. Encrypt the private key with the DEK (AES-256-GCM).
  3. Encrypt the DEK with a Key Encryption Key (KEK) held in Supabase Vault / project secrets (`WALLET_KEK`), never exposed to the client or stored in Postgres in plaintext.
  4. Store `encrypted_private_key` (ciphertext + nonce + encrypted DEK) and `key_encryption_version` in `user_wallets`.
- `wallet_address` is public (visible to the user, used as the on-chain identity); the encrypted private key is only ever decrypted inside an Edge Function using the service-role key + `WALLET_KEK`.
- Because the wallet is stored server-side (not derived from a device-local seed), the address and key remain **identical across devices, browsers, and reinstalls** - satisfying the persistence requirement.

## Private Key Export
- `export-private-key` requires:
  - Valid session JWT.
  - Fresh password confirmation (re-auth, max 5 minutes old).
- Decryption happens entirely server-side; the plaintext key is returned once over TLS and never logged, cached, or written to any table.
- Every export is recorded in `audit_logs` (`wallet.key_exported`) with timestamp, IP, and user agent (but not the key).

## Authorization Model (RBAC + RLS)

Roles per `organization_members.role`:
| Role | Permissions |
|---|---|
| `owner` | Full control: billing, members, all data |
| `admin` | Manage vendors/POs/users (except billing/ownership transfer) |
| `finance_reviewer` | Submit invoices, approve/reject/escalate, trigger GenLayer submissions |
| `viewer` | Read-only access to dashboards, invoices, vendors, audit logs |

### RLS Policy Pattern
```sql
-- Example: invoices table
create policy "org members can select"
  on invoices for select
  using (org_id in (
    select org_id from organization_members where user_id = auth.uid()
  ));

create policy "finance can insert/update"
  on invoices for insert, update
  using (org_id in (
    select org_id from organization_members
    where user_id = auth.uid()
      and role in ('finance_reviewer', 'admin', 'owner')
  ));
```
- `user_wallets`: `select` policy restricted to `user_id = auth.uid()`, and even then `encrypted_private_key` is excluded via a Postgres `view` (`user_wallets_public`) exposing only `wallet_address`. The raw table is only queried by Edge Functions using the service-role key.
- `audit_logs`: insert-only from Edge Functions (service role) and database triggers; `select` available to all org members for transparency.
- `genlayer_validations`: written only by `submit-to-genlayer` / `sync-genlayer-result` (service role); read by org members.

## GenLayer Transaction Signing
- The wallet used to sign `submit_invoice()` transactions is the **wallet of the user performing the submission** (each user has exactly one wallet from signup).
- `submit-to-genlayer` decrypts that user's private key in-memory (service role + `WALLET_KEK`), signs the transaction via the GenLayer SDK, and immediately discards the key from memory - it is never persisted or returned.
- GEN token balance checks occur before submission; insufficient balance returns `GENLAYER_ERROR` with a clear message (funding instructions for StudioNet faucet).

## Encryption in Transit & at Rest
- All client <-> Supabase and Edge Function <-> GenLayer traffic over TLS.
- Supabase-managed Postgres encryption at rest (provider-level).
- Invoice files in Supabase Storage: private buckets, signed URLs with short expiry for viewing.

## Secrets Management
- `WALLET_KEK`, GenLayer RPC endpoint/credentials, Supabase service-role key: stored as Supabase project secrets / environment variables, never committed to the repo.
- `.env.example` files document required variables without values.

## Input Validation
- All Edge Functions validate request bodies against schemas (zod) before processing.
- File uploads restricted by type (PDF/PNG/JPG) and size (configurable max, default 10MB), scanned for type-spoofing via magic-byte check.

## Audit & Immutability
- `audit_logs` is append-only (no update/delete policies granted to any role).
- GenLayer contract maintains its own independent on-chain audit trail as the canonical, tamper-evident record; `audit_logs` + `genlayer_validations` mirror it for fast querying.
