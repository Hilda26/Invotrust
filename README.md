# InvoTrust

**Trust every invoice before you pay.**

InvoTrust is a full-stack invoice validation platform for finance teams. Every invoice is checked
against deterministic fraud/policy rules and then, for higher-risk invoices, submitted on-chain to a
[GenLayer](https://genlayer.com) Intelligent Contract, where a committee of independent LLM validators
reaches consensus on whether to **approve**, **reject**, or **escalate** it — producing an explainable,
tamper-evident audit trail instead of a black-box AI score.

Live app: [invotrust.vercel.app](https://invotrust.vercel.app)

## Why GenLayer

Most "AI fraud detection" is a single model scoring a transaction with no way to audit *why*. InvoTrust
instead submits the invoice, its vendor history, and the organization's procurement policy to an
Intelligent Contract deployed on GenLayer's StudioNet. Multiple validators — running different LLM
providers — independently judge the submission and must reach **Optimistic Democracy** consensus before
a decision is finalized on-chain. The result, reasoning, and risk factors are all part of the permanent
on-chain record, and every organization gets its own wallet (auto-generated at signup) used to sign
submissions.

## Architecture

```
                     ┌────────────────────────────┐
                     │        Next.js App          │
                     │  (Vercel - App Router, TS)  │
                     │                              │
                     │  - Dashboard / Risk Analysis │
                     │  - Invoice Upload/Review     │
                     │  - Vendors / Purchase Orders │
                     │  - Audit Logs                │
                     │  - Settings / Wallet export   │
                     └──────────────┬───────────────┘
                                     │ Supabase JS client (RLS-scoped)
                                     ▼
                     ┌────────────────────────────┐
                     │          Supabase            │
                     │  Postgres (RLS, multi-org)   │
                     │  Auth (email/password)       │
                     │  Storage (invoice files)      │
                     │  Edge Functions (Deno):       │
                     │   - on-signup-wallet          │
                     │   - submit-invoice            │
                     │   - submit-to-genlayer        │
                     │   - sync-genlayer-result       │
                     │   - export-private-key         │
                     │   - block-vendor               │
                     │   - invite-member               │
                     │   - send-notification            │
                     └───────────────┬───────────────┘
                                      │ GenLayer JS SDK (signed tx via org wallet)
                                      ▼
                     ┌────────────────────────────┐
                     │   GenLayer StudioNet          │
                     │   InvoiceValidator             │
                     │   Intelligent Contract         │
                     │   - submit_invoice()           │
                     │   - non-deterministic LLM      │
                     │     analysis + consensus       │
                     │   - get_validation_result()    │
                     │   - on-chain audit trail        │
                     └────────────────────────────┘
```

See [docs/01-architecture.md](docs/01-architecture.md) for the full breakdown, and the rest of `docs/`
for database schema, API design, security design, the GenLayer contract design, and UI/UX design.

## How an invoice gets validated

1. A finance user uploads an invoice. Metadata and file go to Postgres/Storage via the
   `submit-invoice` Edge Function.
2. The function runs deterministic checks — duplicate detection, PO matching, price variance against
   vendor history, payment-timing anomalies — and computes a preliminary risk score.
3. If that score crosses the organization's configured risk threshold (or a user manually requests it),
   `submit-to-genlayer` packages the invoice + vendor + PO context and submits a transaction to the
   `InvoiceValidator` contract, signed with the organization's wallet.
4. GenLayer validators (running different model providers) independently analyze the submission and
   reach consensus via a single `gl.eq_principle.prompt_non_comparative` judgment call — the leader
   proposes a decision, and each validator judges its plausibility rather than trying to independently
   reproduce an identical answer. This is what keeps consensus reliable across heterogeneous models.
5. `sync-genlayer-result` polls the contract, retrieves the decision (Approved / Rejected / Escalated)
   plus structured reasoning, and writes it back into `invoices`, `invoice_analysis`, and `audit_logs`.
6. Vendors on an organization's blocklist skip straight to an auto-rejected fast path without going
   on-chain.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| UI components | [Base UI](https://base-ui.com) primitives (`@base-ui/react`), shadcn-style wrappers, Lucide icons, Recharts |
| Backend / data | Supabase — Postgres (RLS, multi-tenant via `org_id`), Auth, Storage, Edge Functions (Deno) |
| On-chain validation | GenLayer StudioNet, single `InvoiceValidator` Intelligent Contract (Python / GenVM), `genlayer-js` SDK |
| Hosting | Vercel (frontend), Supabase (backend), GenLayer StudioNet (contract) |
| E2E testing | Playwright |

## Repository structure

```
InvoTrust/
├── apps/web/              # Next.js application
│   ├── src/app/            # App Router routes ((auth), (marketing), app/, api/, auth/confirm)
│   ├── src/components/      # shared/ + ui/ component libraries
│   └── src/lib/              # Supabase clients, GenLayer helpers, utils
├── docs/                  # Architecture, schema, API, security, GenLayer, and UI/UX design docs
├── e2e/                   # Playwright end-to-end tests (invoice workflow, on-chain GenLayer flow)
├── genlayer/
│   ├── contracts/          # InvoiceValidator.py (the Intelligent Contract source)
│   └── deployments/        # Deployed contract addresses per network, with redeploy notes
└── supabase/
    ├── functions/           # Edge Functions: on-signup-wallet, submit-invoice, submit-to-genlayer,
    │                         # sync-genlayer-result, export-private-key, block-vendor, invite-member,
    │                         # send-notification
    └── migrations/           # SQL migrations (extensions, schema, RLS policies, triggers)
```

## Getting started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (Postgres + Auth + Storage + Edge Functions)
- A wallet funded with GEN on [GenLayer StudioNet](https://studio.genlayer.com) and a deployed
  `InvoiceValidator` contract (source in [genlayer/contracts/InvoiceValidator.py](genlayer/contracts/InvoiceValidator.py))

### Setup

```bash
git clone https://github.com/Hilda26/Invotrust.git
cd Invotrust/apps/web
npm install
cp .env.example .env.local
```

Fill in `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GENLAYER_CONTRACT_ADDRESS=
```

Apply database migrations and deploy Edge Functions with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy
```

Run the app:

```bash
npm run dev
```

### End-to-end tests

```bash
npm install        # from repo root, installs @playwright/test
npx playwright test
```

`e2e/01-invoice-workflow.spec.ts` covers the full UI workflow; `e2e/02-genlayer-onchain.spec.ts` exercises
the real on-chain submission/consensus path against StudioNet.

## Security notes

- Wallet private keys are generated server-side (never in the browser) and envelope-encrypted at rest;
  export requires re-authentication and is audit-logged. See
  [docs/04-security-design.md](docs/04-security-design.md).
- All tenant data is isolated by `org_id` under Postgres RLS — see
  [docs/02-database-schema.md](docs/02-database-schema.md).
- The contract address in `genlayer/deployments/` is the single source of truth for which
  `InvoiceValidator` deployment is live; it must match `GENLAYER_CONTRACT_ADDRESS` in both the Supabase
  Edge Function secrets and the Vercel project environment variables.

## Documentation

- [docs/01-architecture.md](docs/01-architecture.md) — system architecture & data flow
- [docs/02-database-schema.md](docs/02-database-schema.md) — Postgres schema & ER overview
- [docs/03-api-design.md](docs/03-api-design.md) — Edge Function API design
- [docs/04-security-design.md](docs/04-security-design.md) — auth, wallet custody, key export
- [docs/05-genlayer-design.md](docs/05-genlayer-design.md) — the `InvoiceValidator` Intelligent Contract
- [docs/06-ui-ux-design.md](docs/06-ui-ux-design.md) — design system & UI/UX
- [docs/07-folder-structure.md](docs/07-folder-structure.md) — full repository layout
