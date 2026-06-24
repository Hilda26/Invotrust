# InvoTrust - System Architecture

## Confirmed Stack (Phase 1 Discovery)

- **Database / Auth / Storage**: Supabase (Postgres)
- **Backend logic**: Supabase Edge Functions (Deno) - no separate Node/Fly/Railway service
- **AI / Reasoning engine**: GenLayer Intelligent Contract LLMs only (no external Claude/OpenAI calls)
- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui
- **Frontend hosting**: Vercel
- **Auth model**: Email & Password, with a server-generated blockchain wallet permanently bound to the account, secure private key export
- **Decentralized validation**: GenLayer Intelligent Contract on StudioNet (GEN token fees)

## High-Level Architecture

```
                         ┌────────────────────────────┐
                         │        Next.js App          │
                         │  (Vercel - App Router, TS)  │
                         │                              │
                         │  - Landing / Marketing       │
                         │  - Dashboard                 │
                         │  - Invoice Upload/Review     │
                         │  - Risk Analysis             │
                         │  - Vendor Profiles           │
                         │  - Audit Logs                │
                         │  - Settings / Wallet export   │
                         └──────────────┬───────────────┘
                                         │ Supabase JS client (RLS-scoped)
                                         ▼
                         ┌────────────────────────────┐
                         │          Supabase            │
                         │ ┌──────────────────────────┐ │
                         │ │ Postgres (RLS, multi-org) │ │
                         │ └──────────────────────────┘ │
                         │ ┌──────────────────────────┐ │
                         │ │ Auth (email/password)     │ │
                         │ └──────────────────────────┘ │
                         │ ┌──────────────────────────┐ │
                         │ │ Storage (invoice files)   │ │
                         │ └──────────────────────────┘ │
                         │ ┌──────────────────────────┐ │
                         │ │ Edge Functions (Deno)     │ │
                         │ │  - on-signup-wallet       │ │
                         │ │  - submit-invoice         │ │
                         │ │  - submit-to-genlayer     │ │
                         │ │  - sync-genlayer-result   │ │
                         │ │  - export-private-key     │ │
                         │ └─────────────┬─────────────┘ │
                         └───────────────┼───────────────┘
                                          │ GenLayer JS SDK (signed tx via org wallet)
                                          ▼
                         ┌────────────────────────────┐
                         │   GenLayer StudioNet          │
                         │   InvoiceValidator            │
                         │   Intelligent Contract        │
                         │                                │
                         │  - submit_invoice()            │
                         │  - nondet LLM analysis         │
                         │  - Optimistic Democracy        │
                         │    consensus among validators  │
                         │  - get_validation_result()     │
                         │  - audit trail storage          │
                         └────────────────────────────┘
```

## Component Responsibilities

### Frontend (Next.js)
- All UI/UX described in Phase 3.
- Talks to Supabase directly for reads/writes covered by RLS (invoices, vendors, POs, audit logs).
- Calls Edge Functions for privileged operations (wallet creation, GenLayer submission, key export).
- Polls / subscribes (Supabase Realtime) for GenLayer validation status updates.

### Supabase Postgres
- System of record for all invoice, vendor, PO, and audit data.
- Multi-tenant via `organizations` + RLS policies keyed on `org_id`.
- Stores cached GenLayer validation results for fast UI rendering (contract remains source of truth for consensus reasoning/audit).

### Supabase Edge Functions
- `on-signup-wallet`: triggered after user registration, generates a wallet keypair, encrypts the private key, stores it, links wallet address to the user profile.
- `submit-invoice`: receives invoice metadata + file, runs deterministic pre-checks (duplicate detection, PO match, pricing deviation vs vendor history) using SQL, computes a preliminary risk score.
- `submit-to-genlayer`: for invoices above a risk threshold (or on demand), packages invoice + vendor + PO context and submits a transaction to the `InvoiceValidator` Intelligent Contract using the organization's wallet.
- `sync-genlayer-result`: polls / listens for contract validation results and writes consensus outcome + reasoning + risk factors back into Postgres.
- `export-private-key`: re-authenticates the user, decrypts and returns the private key (one-time, audit-logged).

### GenLayer Intelligent Contract (StudioNet)
- Single contract: `InvoiceValidator`.
- Performs AI-powered analysis via GenLayer's built-in non-deterministic LLM calls (no external AI vendor).
- Validators reach consensus via Optimistic Democracy (`eq_principle` comparisons).
- Produces: decision (Approved / Rejected / Escalated), structured risk factors, explanation text.
- Maintains an on-chain, immutable audit trail of all submissions and decisions.

## Data Flow: Invoice Lifecycle

1. User uploads invoice (file -> Supabase Storage, metadata -> Postgres via `submit-invoice` Edge Function).
2. Edge Function runs deterministic checks (duplicate hash, PO match, price variance vs vendor history, payment timing anomalies) and computes a preliminary risk score.
3. If preliminary score crosses the configured threshold (or user manually requests), `submit-to-genlayer` sends the invoice context to the `InvoiceValidator` contract.
4. GenLayer validators independently run LLM-based analysis (vendor credibility, pricing deviation, fraud indicators, policy compliance) and reach Optimistic Democracy consensus.
5. `sync-genlayer-result` retrieves the consensus decision + reasoning and updates `invoices`, `invoice_analysis`, and `audit_logs`.
6. Dashboard/Risk Analysis pages render the explainable result; finance reviewers approve/reject/escalate within InvoTrust, with all actions written to `audit_logs`.

## Multi-Tenancy
- `organizations` table is the tenancy boundary.
- Every business table carries `org_id`.
- RLS policies enforce `org_id = (select org_id from organization_members where user_id = auth.uid())` style checks (refined in Security Design).
- Each organization has exactly one wallet (created at org-creation time, owned/controlled via the creating user's auto-generated wallet, or a dedicated org wallet - decided in Security Design).
