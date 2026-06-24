# InvoTrust - UI/UX Design

Stack: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Radix primitives + Recharts (data viz) + Lucide icons.

## Design System

### Brand
- **Tagline**: "Trust Every Invoice Before You Pay."
- **Tone**: trustworthy, precise, fintech/enterprise (think Stripe / Mercury / Ramp), not playful.

### Color Tokens (Tailwind theme, CSS variables for light/dark)
| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | #FFFFFF | #0B0F17 | page background |
| `--foreground` | #0B0F17 | #F5F7FA | primary text |
| `--primary` | #2563EB (blue-600) | #3B82F6 | brand actions, links |
| `--primary-foreground` | #FFFFFF | #0B0F17 | text on primary |
| `--muted` | #F1F5F9 | #111827 | cards, panels |
| `--muted-foreground` | #64748B | #94A3B8 | secondary text |
| `--success` | #16A34A | #22C55E | "Approved" |
| `--warning` | #D97706 | #F59E0B | "Escalated" |
| `--destructive` | #DC2626 | #EF4444 | "Rejected" / fraud risk |
| `--border` | #E2E8F0 | #1F2937 | dividers, card borders |
| `--accent-genlayer` | #7C3AED (violet-600) | #A78BFA | GenLayer/blockchain-related UI (badges, chain status) |

### Typography
- Font: `Inter` (UI), `JetBrains Mono` (wallet addresses, tx hashes, contract data).
- Scale: `text-xs` (12px) metadata -> `text-sm` (14px) body -> `text-base` (16px) -> `text-lg/xl` headings -> `text-3xl/4xl` hero/landing only.

### Risk Score Visualization
- A circular/radial gauge component (`RiskGauge`) with color thresholds:
  - 0-39: `success` (Low risk)
  - 40-69: `warning` (Medium risk)
  - 70-100: `destructive` (High risk)
- Used consistently across Dashboard, Invoice Review, Risk Analysis, Vendor Profiles.

### Core Reusable Components (`src/components/ui` = shadcn primitives, `src/components/shared` = InvoTrust-specific)
- `RiskGauge` - radial score indicator with label.
- `RiskBadge` - pill: Low/Medium/High with color.
- `StatusBadge` - Pending / Under Review / Approved / Rejected / Escalated.
- `GenLayerStatusBadge` - On-chain status (Pending / Confirmed) with tx-hash link + violet accent.
- `AnomalyFlagList` - list of `{type, severity, detail}` with icons.
- `ExplainabilityPanel` - collapsible "Why this score?" card rendering `reasoning` + `risk_factors` as a weighted list/chart.
- `WalletAddressChip` - truncated address, copy button, link to explorer.
- `DataTable` - generic sortable/filterable table (invoices, vendors, audit logs) built on `@tanstack/react-table`.
- `EmptyState`, `PageHeader`, `StatCard`, `Timeline` (audit trail), `FileDropzone` (invoice upload), `OrgSwitcher`, `NavSidebar`, `TopBar`, `ConfirmDialog` (re-auth for sensitive actions).

## Information Architecture / Routing (App Router)

```
/                          Landing page (public, marketing)
/pricing                   Pricing page (public)
/login                     Auth
/signup                    Auth (triggers wallet creation)
/onboarding                Create/join organization

/app                       Authenticated shell (sidebar layout)
  /app/dashboard           Dashboard (default landing after login)
  /app/invoices            Invoice list
  /app/invoices/upload     Invoice Upload
  /app/invoices/[id]       Invoice Review (single invoice)
  /app/risk                Risk Analysis (portfolio-level)
  /app/risk/[invoiceId]    Deep-dive risk explanation (or reuse invoice detail tab)
  /app/vendors             Vendor list
  /app/vendors/[id]        Vendor Profile
  /app/audit-logs          Audit Logs
  /app/settings            Settings (tabs: Profile, Organization, Wallet, Members, Policy)
```

## Page Designs

### Landing Page (`/`)
- **Hero**: headline "Trust Every Invoice Before You Pay.", subheadline on AI + GenLayer decentralized validation, primary CTA "Start Free Trial", secondary "Book a Demo". Background: subtle animated gradient + abstract invoice/network graphic.
- **Trust bar**: logos placeholder row ("Built for finance teams at...").
- **Problem section**: 3-4 stat cards (e.g. "$X lost to invoice fraud annually", "X% of invoices have errors") with icons.
- **Solution / How it works**: 4-step horizontal timeline - Upload -> AI Analysis -> Risk Score & Explanation -> Decentralized Validation (GenLayer) -> Approve/Reject.
- **Features grid** (6 cards): AI Anomaly Detection, Explainable Risk Scoring, Vendor Reputation, Duplicate/PO Matching, Decentralized Validation (GenLayer badge), Full Audit Trail.
- **Product preview**: large screenshot/mockup of the Dashboard inside a browser frame.
- **Pricing** section (3 tiers: Starter, Growth, Enterprise) - feature comparison table.
- **CTA section**: "Stop fraud before it costs you" + signup button.
- **Footer**: links, social, legal.

### Dashboard (`/app/dashboard`)
- `PageHeader`: "Dashboard", date range picker, org switcher.
- Row of `StatCard`s: Total Invoices (period), Total Amount Reviewed, High-Risk Invoices, Avg Risk Score, GEN balance (with low-balance warning).
- Charts row: Invoice volume over time (line), Risk score distribution (bar/histogram), Decision breakdown Approved/Rejected/Escalated (donut).
- "Needs Attention" table: invoices with `status = escalated` or `final_risk_score >= threshold`, with quick-action buttons (Review).
- Recent activity feed (latest `audit_logs`).

### Invoice Upload (`/app/invoices/upload`)
- `FileDropzone` for PDF/image upload (drag/drop + browse), preview thumbnail.
- Form fields: Vendor (searchable select, "+ new vendor"), PO (optional searchable select), Invoice number, Amount, Currency, Issue date, Due date.
- Line items editable table (add/remove rows, auto-sum total vs entered amount, mismatch warning).
- Submit button -> calls `submit-invoice`; on success, shows preliminary risk result inline (badge + flags) with option "Submit to GenLayer for validation" (or shows "auto-submitted" if above threshold).
- Success state redirects to Invoice Review page.

### Invoice Review (`/app/invoices/[id]`)
- Two-column layout:
  - Left: invoice document preview (PDF/image viewer), metadata card (vendor, PO, amounts, dates).
  - Right: tabs - **Overview** (status, `RiskGauge`, `AnomalyFlagList`, GenLayer status), **Explainability** (`ExplainabilityPanel` with full reasoning + risk factors chart), **Line Items** (table), **History** (`Timeline` of audit entries for this invoice).
- Action bar (sticky): Approve / Reject / Escalate (role-gated to `finance_reviewer`/`admin`/`owner`), "Re-run GenLayer Validation", "View on-chain" (links contract explorer via tx hash).
- If `status = pending` and not yet submitted to GenLayer: "Submit for Decentralized Validation" CTA.

### Risk Analysis (`/app/risk`)
- Portfolio-level view: filterable `DataTable` of all invoices with columns (Invoice #, Vendor, Amount, Risk Score with `RiskGauge` mini, Status, Submitted date), filters by risk band, status, vendor, date range.
- Side panel (drawer) on row click: condensed `ExplainabilityPanel` + link to full Invoice Review.
- Top summary cards: distribution of risk bands, top anomaly types this period (bar chart).

### Vendor Profiles
- `/app/vendors`: `DataTable` of vendors - name, reputation score (`RiskGauge` inverted scale or simple score bar), total invoices, flagged count, status badge.
- `/app/vendors/[id]`: header card (name, tax ID, status, reputation score trend chart over time), tabs - **Invoices** (DataTable scoped to vendor), **Pricing History** (chart of unit prices over time per item type), **Flags & History** (`Timeline` of flagged invoices/decisions).
- Admin actions: "Mark under review", "Block vendor" (role-gated).

### Audit Logs (`/app/audit-logs`)
- Filterable `DataTable`: timestamp, actor (user or "GenLayer Contract"), action, entity type/id (linked), details (expandable jsonb).
- Filters: date range, action type, entity type, actor.
- "Verify on-chain" button per GenLayer-related entry, linking to the contract's `get_audit_trail` result / explorer.

### Settings (`/app/settings`)
Tabs:
- **Profile**: name, email, password change.
- **Wallet**: wallet address (`WalletAddressChip`), GEN balance, "Export Private Key" (re-auth flow via `ConfirmDialog` -> calls `export-private-key`, shows key once with copy + "I've saved it" confirmation, never re-displayable).
- **Organization**: name, slug, plan, `risk_threshold` slider, `procurement_policy` text editor (markdown).
- **Members**: invite/manage members + roles (`DataTable`).
- **GenLayer**: contract address (read-only), network (StudioNet), last sync status.

## Navigation
- Authenticated shell: collapsible left `NavSidebar` (Dashboard, Invoices, Risk Analysis, Vendors, Audit Logs, Settings) + `TopBar` (org switcher, GEN balance pill, user menu).
- Mobile: sidebar collapses to bottom nav / hamburger drawer.

## Core User Flows
1. **Signup -> Onboarding**: Signup (email/password) -> wallet auto-created (loading state "Setting up your secure wallet...") -> Onboarding creates first organization -> redirected to empty Dashboard with "Upload your first invoice" empty state.
2. **Upload -> Review -> Decision**: Upload form -> preliminary result shown inline -> (auto or manual) GenLayer submission -> Invoice Review page polls/subscribes for consensus result -> Explainability tab populates -> reviewer approves/rejects/escalates.
3. **Vendor drill-down**: Dashboard "Needs Attention" -> Invoice Review -> vendor name link -> Vendor Profile -> Invoices tab shows full history.
4. **Audit/compliance**: Audit Logs filtered by entity -> click invoice -> Invoice Review -> History tab cross-references same audit entries.

## Responsiveness & Accessibility
- All pages responsive down to ~375px (mobile review of invoices on the go).
- WCAG AA color contrast for all status/risk colors (verified against both light/dark backgrounds).
- Keyboard navigable tables and dialogs (Radix-based components provide this by default).
