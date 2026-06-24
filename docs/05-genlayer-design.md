# InvoTrust - GenLayer Intelligent Contract Design

Reference: https://docs.genlayer.com/ , https://docs.genlayer.com/developers/intelligent-contracts/ideas , https://skills.genlayer.com/

## Single Contract: `InvoiceValidator`

One Intelligent Contract (Python / GenVM) deployed once to **StudioNet**, reused for every organization and invoice. Per-invoice data is namespaced by `(org_id, invoice_id)` keys in contract storage.

### Storage Layout (conceptual)
```python
class InvoiceValidator(gl.Contract):
    submissions: TreeMap[str, InvoiceSubmission]   # key = f"{org_id}:{invoice_id}"
    validations: TreeMap[str, ValidationResult]    # key = f"{org_id}:{invoice_id}"
    vendor_history: TreeMap[str, VendorSummary]    # key = f"{org_id}:{vendor_id}"
    audit_trail: DynArray[AuditEntry]              # append-only
```

- `InvoiceSubmission`: invoice metadata, vendor summary snapshot, PO match data, deterministic flags from InvoTrust's pre-checks.
- `ValidationResult`: `decision` (Approved/Rejected/Escalated), `risk_score`, `risk_factors` (list of {factor, weight, detail}), `reasoning` (text), `validator_votes`, `resolved_at`.
- `VendorSummary`: rolling stats (avg price, invoice count, flag count, reputation score) used as context for future submissions - this is the contract's persistent "memory" of vendor behavior, independent of InvoTrust's own DB.
- `AuditEntry`: immutable log of every submission and decision (timestamp, org_id, invoice_id, actor wallet, decision).

### Methods

#### `submit_invoice(org_id, invoice_id, payload: dict) -> str`
- Write-method, called by `submit-to-genlayer` Edge Function (signed by the submitting user's wallet).
- Stores `InvoiceSubmission`.
- Internally invokes `_run_validation(org_id, invoice_id)`.
- Returns a submission receipt id.

#### `_run_validation(org_id, invoice_id)` (internal, nondet)
Runs the AI analysis using GenLayer's nondeterministic LLM block (`gl.eq_principle_*` / `gl.nondet`), broken into reasoning steps so each validator can independently produce a result and reach consensus via **Optimistic Democracy**:

1. **Vendor credibility check** - LLM evaluates `VendorSummary` + submitted vendor metadata for plausibility (new vendor with no history submitting a large invoice, mismatched tax IDs, etc.).
2. **Pricing deviation analysis** - LLM reviews line items vs `VendorSummary.avg_price` and PO match data, flags inflated pricing.
3. **Fraud indicator detection** - LLM reviews the combined deterministic flags (duplicate, PO mismatch, payment timing) plus free-text invoice fields for known fraud patterns (e.g. urgency language, bank-detail-change requests).
4. **Procurement policy compliance** - LLM checks invoice against org-level policy text (configurable per organization, passed in `payload`).
5. **Aggregation** - LLM combines the above into a final `risk_score` (0-100), `decision`, structured `risk_factors`, and a human-readable `reasoning` narrative.

Each step uses an equivalence principle (e.g. `gl.eq_principle_prompt_comparative`) so validators' non-deterministic LLM outputs are reconciled into a single agreed-upon result without requiring byte-identical outputs.

#### `get_validation_result(org_id, invoice_id) -> ValidationResult`
- Read-only view method, called by `sync-genlayer-result`.
- Returns `None`/pending status until consensus resolves.

#### `get_audit_trail(org_id, invoice_id=None) -> list[AuditEntry]`
- Read-only, supports the Audit Logs page (on-chain proof, supplementary to Postgres `audit_logs`).

## Consensus Workflow (Optimistic Democracy)

1. Leader validator executes `_run_validation`, performing the nondet LLM steps and proposing a `ValidationResult`.
2. Other validators independently re-execute the nondet block (each with their own LLM call) and compare results against the leader's proposal using the configured equivalence principle (semantic/comparative, since LLM text output is non-deterministic).
3. If a quorum of validators agree the results are equivalent within tolerance, the result is finalized (`status = approved/rejected/escalated` per the agreed `decision`).
4. If validators disagree beyond tolerance (e.g. split between Approve and Escalate), the contract sets `decision = escalated` with `reasoning` summarizing the disagreement - surfaced to a human reviewer in InvoTrust.
5. Finalization appends an `AuditEntry` and updates `VendorSummary` (rolling averages, flag counts).

## Decision Semantics
- **Approved**: `risk_score` below org's approval threshold and no high-severity fraud indicators -> InvoTrust marks invoice `approved` (still subject to human override).
- **Rejected**: high-confidence fraud indicators (duplicate, fake vendor, severe price manipulation) -> invoice `rejected`, vendor `flagged_invoices` incremented; repeated rejections may auto-flag vendor `status = under_review`.
- **Escalated**: ambiguous or validator disagreement -> invoice `escalated`, requires human finance reviewer decision in InvoTrust; the reviewer's final decision is written back to `audit_logs` (not to the contract, to keep the contract's record as the validators' independent assessment).

## StudioNet Deployment Strategy
1. Develop and unit-test the contract locally against the GenLayer Studio simulator (per skills.genlayer.com guidance).
2. Deploy the single `InvoiceValidator` contract to StudioNet using the GenLayer CLI/Studio (already configured per Phase 1 answers).
3. Record the deployed contract address in `supabase/.env` as `GENLAYER_CONTRACT_ADDRESS` and in `genlayer/deployments/studionet.json`.
4. **Pause point**: once deployed, the user provides the contract address; all subsequent Edge Function integration (`submit-to-genlayer`, `sync-genlayer-result`) is wired against that fixed address.
5. GEN token fees: each organization's submitting user must hold GEN on StudioNet; InvoTrust surfaces balance and a faucet link in Settings if balance is insufficient.

## Open Design Note
- Per-organization "procurement policy text" referenced in step 4 of validation will be stored in `organizations` (new column `procurement_policy text`, added in the schema migration) and passed as part of `payload` on each `submit_invoice` call - to be added to `02-database-schema.md` when migrations are generated.
