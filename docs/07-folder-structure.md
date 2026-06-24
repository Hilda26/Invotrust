# InvoTrust - Project Folder Structure

```
InvoTrust/
├── docs/                                 # Architecture, design, and process docs (Phases 1-4)
│   ├── 01-architecture.md
│   ├── 02-database-schema.md
│   ├── 03-api-design.md
│   ├── 04-security-design.md
│   ├── 05-genlayer-design.md
│   ├── 06-ui-ux-design.md
│   ├── 07-folder-structure.md
│   └── adr/                             # Architecture Decision Records (one .md per major decision)
│
├── apps/
│   └── web/                             # Next.js application (deployed to Vercel)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (marketing)/         # Landing, pricing - public layout
│       │   │   │   ├── page.tsx
│       │   │   │   └── pricing/page.tsx
│       │   │   ├── (auth)/               # login, signup, onboarding - auth layout
│       │   │   │   ├── login/page.tsx
│       │   │   │   ├── signup/page.tsx
│       │   │   │   └── onboarding/page.tsx
│       │   │   ├── app/                  # authenticated shell
│       │   │   │   ├── layout.tsx        # sidebar + topbar shell
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── invoices/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── upload/page.tsx
│       │   │   │   │   └── [id]/page.tsx
│       │   │   │   ├── risk/page.tsx
│       │   │   │   ├── vendors/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── [id]/page.tsx
│       │   │   │   ├── audit-logs/page.tsx
│       │   │   │   └── settings/
│       │   │   │       ├── layout.tsx
│       │   │   │       ├── profile/page.tsx
│       │   │   │       ├── wallet/page.tsx
│       │   │   │       ├── organization/page.tsx
│       │   │   │       ├── members/page.tsx
│       │   │   │       └── genlayer/page.tsx
│       │   │   ├── api/                  # Next.js route handlers (thin proxies if needed)
│       │   │   ├── layout.tsx
│       │   │   └── globals.css
│       │   ├── components/
│       │   │   ├── ui/                   # shadcn primitives (button, dialog, table, etc.)
│       │   │   └── shared/               # RiskGauge, RiskBadge, StatusBadge, ExplainabilityPanel, etc.
│       │   ├── lib/
│       │   │   ├── supabase/             # client.ts, server.ts, middleware.ts
│       │   │   ├── genlayer/             # client SDK wrapper, types
│       │   │   ├── validations/          # zod schemas (shared with edge functions where possible)
│       │   │   └── utils.ts
│       │   ├── hooks/                    # useInvoices, useVendors, useRiskScore, etc.
│       │   ├── types/                    # generated Supabase types + domain types
│       │   └── styles/
│       ├── public/
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/                      # Playwright
│       ├── .env.example
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── supabase/
│   ├── config.toml
│   ├── migrations/                       # SQL migrations (schema, RLS policies, triggers)
│   ├── seed/                             # seed.sql for demo data
│   └── functions/                        # Edge Functions (Deno)
│       ├── on-signup-wallet/
│       ├── submit-invoice/
│       ├── submit-to-genlayer/
│       ├── sync-genlayer-result/
│       ├── export-private-key/
│       └── _shared/                      # shared utils (crypto, genlayer client, zod schemas)
│
├── genlayer/
│   ├── contracts/
│   │   └── invoice_validator.py          # the InvoiceValidator Intelligent Contract
│   ├── tests/                            # GenLayer Studio simulator tests
│   ├── deployments/
│   │   └── studionet.json                # deployed contract address + metadata
│   └── README.md
│
├── infra/
│   ├── vercel.json
│   └── README.md                         # env var matrix, deployment notes
│
├── scripts/
│   ├── setup/                            # one-time setup scripts (Python, per workflow rules)
│   ├── db/                               # migration helpers
│   └── dev/                              # local dev helpers
│
├── .github/
│   └── workflows/
│       ├── ci.yml                        # lint, typecheck, unit/integration tests
│       ├── deploy-web.yml                # Vercel deploy
│       └── deploy-functions.yml          # Supabase functions deploy
│
├── .gitignore
├── .editorconfig
├── README.md
└── package.json                          # workspace root (npm/pnpm workspaces)
```

## Notes
- `apps/web` is a workspace package; root `package.json` uses npm/pnpm workspaces so `supabase/functions` shared code (`_shared`) can be referenced via relative imports per Deno conventions.
- `docs/adr/` will hold short decision records for any non-trivial choices made during implementation (e.g. specific GenLayer SDK version pinning).
- `genlayer/` is kept separate from `supabase/functions` so the contract can be developed/tested independently in the GenLayer Studio simulator before Edge Functions are wired to a deployed address.
- Environment variables are documented in `.env.example` files at each relevant level (`apps/web/.env.example`, `supabase/.env.example`) - never with real values.
