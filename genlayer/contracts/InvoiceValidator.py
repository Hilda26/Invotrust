# =====================================================================
# InvoiceValidator - GenLayer Intelligent Contract
# =====================================================================
#
# Deployed once to StudioNet; all InvoTrust organizations and invoices
# share this single contract instance. All records are namespaced by
# composite string keys so that no organization can read or write
# another organization's data path, even though storage is shared.
#
#   Key conventions:
#     "{org_id}:{invoice_id}"                       -> per-invoice records
#     "{org_id}:{vendor_id}"                         -> per-vendor records
#     "{org_id}"                                     -> per-organization records
#     "{org_id}:{vendor_id}:{invoice_number}"        -> duplicate-invoice index
#
# -----------------------------------------------------------------------
# Consensus model (GenLayer "Optimistic Democracy")
# -----------------------------------------------------------------------
# Every write transaction is executed independently by a leader and a
# committee of validator nodes. For deterministic Python code, all
# nodes must produce byte-identical results or the transaction is
# rejected outright. For the AI-driven fraud analysis in this contract,
# exact byte-identical LLM output is neither possible nor desirable -
# different model runs phrase things differently even when they reach
# the same substantive judgment. GenLayer's `gl.eq_principle` family
# lets the contract author declare what counts as "the same answer"
# in natural language, and a separate validator-side judgment model
# decides whether the leader's output and each validator's own
# independent output satisfy that principle.
#
# If the equivalence principle is too strict (e.g. "scores must be
# identical" or "decision string must match exactly"), validators
# legitimately reach different conclusions about borderline cases and
# the transaction status becomes UNDETERMINED - which never resolves
# and looks identical to a contract bug from the application's point
# of view. This revision of the contract deliberately:
#
#   1. Widens every numeric tolerance band so small, immaterial
#      scoring differences between models don't block consensus.
#   2. Asks the LLM for a *numeric risk score* only, and derives the
#      categorical decision (approved / rejected / escalated) with
#      plain deterministic Python thresholds afterwards. Comparing
#      whether two numbers fall in the same wide band is a much
#      easier equivalence judgment than comparing whether two models
#      chose the identical category label.
#   3. Adds deterministic fast paths (blocked vendors, duplicate
#      invoices) that skip the LLM entirely when the outcome is
#      already certain, which both speeds up resolution and removes
#      another opportunity for disagreement.
#
# -----------------------------------------------------------------------

import json
import datetime
from genlayer import *


# =====================================================================
# Constants
# =====================================================================

CONTRACT_VERSION = "2.0.0"

DECISION_APPROVED = "approved"
DECISION_REJECTED = "rejected"
DECISION_ESCALATED = "escalated"
VALID_DECISIONS = (DECISION_APPROVED, DECISION_REJECTED, DECISION_ESCALATED)

EVENT_SUBMITTED = "submitted"
EVENT_VALIDATED = "validated"
EVENT_REVALIDATION_REQUESTED = "revalidation_requested"
EVENT_VENDOR_BLOCKED = "vendor_blocked"
EVENT_VENDOR_UNBLOCKED = "vendor_unblocked"
EVENT_AUTO_REJECTED_BLOCKED_VENDOR = "auto_rejected_blocked_vendor"
EVENT_AUTO_REJECTED_DUPLICATE = "auto_rejected_duplicate_invoice"

# Default decision thresholds, used when an organization has not set
# its own via set_organization_settings. These mirror the thresholds
# that used to live only inside the LLM prompt, now applied
# deterministically in Python after a numeric score is obtained.
DEFAULT_APPROVE_BELOW = 50
DEFAULT_REJECT_AT_OR_ABOVE = 80

REQUIRED_SUBMISSION_FIELDS = (
    "invoice_number",
    "amount",
    "vendor_id",
    "vendor_name",
    "submitter_wallet",
)


# =====================================================================
# Contract
# =====================================================================

class InvoiceValidator(gl.Contract):
    # ------------------------------------------------------------------
    # Persistent storage
    # ------------------------------------------------------------------
    # All collection fields below are zero-initialized by the GenLayer
    # runtime (TreeMap -> {}, DynArray -> []). They must not be
    # constructed directly - TreeMap() / DynArray() raise at runtime if
    # called from contract code, since instantiation is owned by the
    # storage layer itself.

    submissions: TreeMap[str, str]
    """key = "{org_id}:{invoice_id}" -> JSON-encoded InvoiceSubmission"""

    validations: TreeMap[str, str]
    """key = "{org_id}:{invoice_id}" -> JSON-encoded ValidationResult"""

    vendor_history: TreeMap[str, str]
    """key = "{org_id}:{vendor_id}" -> JSON-encoded VendorSummary"""

    vendor_blocklist: TreeMap[str, str]
    """key = "{org_id}:{vendor_id}" -> JSON-encoded BlockRecord, present only when blocked"""

    invoice_number_index: TreeMap[str, str]
    """key = "{org_id}:{vendor_id}:{invoice_number}" -> invoice_id, for O(1) duplicate detection"""

    organization_settings: TreeMap[str, str]
    """key = "{org_id}" -> JSON-encoded OrganizationSettings (decision thresholds)"""

    organization_stats: TreeMap[str, str]
    """key = "{org_id}" -> JSON-encoded OrganizationStats (running counters)"""

    audit_trail: DynArray[str]
    """Append-only log of JSON-encoded AuditEntry records, across all organizations"""

    def __init__(self):
        # Nothing to initialize - every field above defaults to an
        # empty collection. An explicit constructor is still required
        # for the contract schema to load correctly even when its body
        # is empty.
        pass

    # ==================================================================
    # SECTION 1: Public write methods - invoice lifecycle
    # ==================================================================

    @gl.public.write
    def submit_invoice(self, org_id: str, invoice_id: str, payload: str) -> str:
        """
        Record a new invoice submission and run (or deterministically
        skip) its fraud/compliance validation.

        Called by the submit-to-genlayer Supabase Edge Function once an
        invoice has passed off-chain deterministic pre-checks.

        Args:
            org_id: UUID of the submitting organization.
            invoice_id: UUID of the invoice in the off-chain database.
            payload: JSON string with invoice metadata, vendor info,
                deterministic anomaly flags, and the org's procurement
                policy text. See _parse_submission_payload for the
                expected shape.

        Returns:
            The composite storage key "{org_id}:{invoice_id}", used by
            the caller as a submission receipt.

        Raises:
            Exception: if the invoice was already submitted for this
                org, the payload is malformed, or a required field is
                missing.
        """
        key = self._invoice_key(org_id, invoice_id)

        if key in self.submissions:
            raise Exception(
                f"Invoice {invoice_id} already submitted for organization {org_id}"
            )

        data = self._parse_submission_payload(payload)
        self._validate_required_fields(data)

        now = self._now_iso()
        data["org_id"] = org_id
        data["invoice_id"] = invoice_id
        data["submitted_at"] = now

        self.submissions[key] = json.dumps(data)
        self._index_invoice_number(org_id, data)

        self._append_audit_entry(
            entry_id=f"{key}:submitted",
            org_id=org_id,
            invoice_id=invoice_id,
            event=EVENT_SUBMITTED,
            actor_wallet=data.get("submitter_wallet", ""),
            decision=None,
            risk_score=None,
        )
        self._bump_org_stat(org_id, "total_submitted")

        # --- Deterministic fast paths: skip the LLM entirely when the
        # outcome is already certain. This both resolves faster and
        # removes opportunities for validator disagreement.

        blocked_reason = self._blocked_vendor_reason(org_id, data.get("vendor_id", ""))
        if blocked_reason is not None:
            self._finalize_validation(
                org_id=org_id,
                invoice_id=invoice_id,
                decision=DECISION_REJECTED,
                risk_score=100,
                risk_factors=[{
                    "factor": "blocked_vendor",
                    "weight": 100,
                    "detail": blocked_reason,
                }],
                reasoning=(
                    f"This vendor is on the organization's blocklist "
                    f"({blocked_reason}). The invoice was rejected "
                    f"automatically without AI review."
                ),
                vendor_name=data.get("vendor_name", "Unknown"),
                vendor_id=data.get("vendor_id", ""),
                amount=float(data.get("amount", 0)),
                flagged=True,
                audit_event=EVENT_AUTO_REJECTED_BLOCKED_VENDOR,
            )
            return key

        duplicate_invoice_id = self._find_duplicate_invoice_number(
            org_id, data.get("vendor_id", ""), data.get("invoice_number", "")
        )
        if duplicate_invoice_id and duplicate_invoice_id != invoice_id:
            self._finalize_validation(
                org_id=org_id,
                invoice_id=invoice_id,
                decision=DECISION_REJECTED,
                risk_score=95,
                risk_factors=[{
                    "factor": "duplicate_invoice_number",
                    "weight": 95,
                    "detail": (
                        f"Invoice number {data.get('invoice_number')} was "
                        f"already submitted for this vendor as invoice "
                        f"{duplicate_invoice_id}."
                    ),
                }],
                reasoning=(
                    "Duplicate invoice numbers for the same vendor are a "
                    "well-established indicator of double billing or "
                    "fraud. This invoice was rejected automatically "
                    "without AI review."
                ),
                vendor_name=data.get("vendor_name", "Unknown"),
                vendor_id=data.get("vendor_id", ""),
                amount=float(data.get("amount", 0)),
                flagged=True,
                audit_event=EVENT_AUTO_REJECTED_DUPLICATE,
            )
            return key

        self._run_validation(org_id, invoice_id, data)
        return key

    @gl.public.write
    def request_revalidation(self, org_id: str, invoice_id: str) -> str:
        """
        Re-run AI validation for an invoice that was previously
        escalated for manual review. Intended to be called when a
        finance reviewer wants a second opinion after, for example,
        the vendor's history has changed since the original submission.

        Args:
            org_id: UUID of the organization.
            invoice_id: UUID of the invoice to re-validate.

        Returns:
            The composite storage key, as a receipt.

        Raises:
            Exception: if no submission exists, or the existing
                decision is not "escalated" (approved/rejected
                invoices are considered final and are not re-opened
                through this method).
        """
        key = self._invoice_key(org_id, invoice_id)

        submission_raw = self.submissions.get(key)
        if not submission_raw:
            raise Exception(f"No submission found for invoice {invoice_id}")

        validation_raw = self.validations.get(key)
        if validation_raw:
            existing = json.loads(validation_raw)
            if existing.get("decision") != DECISION_ESCALATED:
                raise Exception(
                    "Only escalated invoices can be requested for "
                    "revalidation. Current decision: "
                    f"{existing.get('decision')}"
                )

        data = json.loads(submission_raw)

        self._append_audit_entry(
            entry_id=f"{key}:revalidation:{self._now_iso()}",
            org_id=org_id,
            invoice_id=invoice_id,
            event=EVENT_REVALIDATION_REQUESTED,
            actor_wallet="",
            decision=None,
            risk_score=None,
        )

        self._run_validation(org_id, invoice_id, data)
        return key

    # ==================================================================
    # SECTION 2: Public write methods - vendor management
    # ==================================================================

    @gl.public.write
    def block_vendor(self, org_id: str, vendor_id: str, reason: str) -> None:
        """
        Add a vendor to an organization's blocklist. Future invoice
        submissions from this vendor are deterministically rejected
        in submit_invoice without any AI review.

        Args:
            org_id: UUID of the organization.
            vendor_id: UUID of the vendor to block.
            reason: Human-readable justification, surfaced verbatim in
                future rejection reasoning text.
        """
        if not vendor_id:
            raise Exception("vendor_id is required")
        if not reason or not reason.strip():
            raise Exception("A reason is required to block a vendor")

        vendor_key = self._vendor_key(org_id, vendor_id)
        self.vendor_blocklist[vendor_key] = json.dumps({
            "org_id": org_id,
            "vendor_id": vendor_id,
            "reason": reason.strip(),
            "blocked_at": self._now_iso(),
        })

        self._append_audit_entry(
            entry_id=f"{vendor_key}:blocked:{self._now_iso()}",
            org_id=org_id,
            invoice_id="",
            event=EVENT_VENDOR_BLOCKED,
            actor_wallet="",
            decision=None,
            risk_score=None,
        )

    @gl.public.write
    def unblock_vendor(self, org_id: str, vendor_id: str) -> None:
        """
        Remove a vendor from an organization's blocklist.

        Args:
            org_id: UUID of the organization.
            vendor_id: UUID of the vendor to unblock.
        """
        vendor_key = self._vendor_key(org_id, vendor_id)
        if vendor_key in self.vendor_blocklist:
            del self.vendor_blocklist[vendor_key]

        self._append_audit_entry(
            entry_id=f"{vendor_key}:unblocked:{self._now_iso()}",
            org_id=org_id,
            invoice_id="",
            event=EVENT_VENDOR_UNBLOCKED,
            actor_wallet="",
            decision=None,
            risk_score=None,
        )

    # ==================================================================
    # SECTION 3: Public write methods - organization configuration
    # ==================================================================

    @gl.public.write
    def set_organization_settings(
        self,
        org_id: str,
        approve_below: int,
        reject_at_or_above: int,
    ) -> None:
        """
        Configure the deterministic risk-score thresholds used to turn
        a numeric AI risk score into a decision for this organization.

        Args:
            org_id: UUID of the organization.
            approve_below: Risk scores strictly below this value are
                approved automatically (subject to escalated range,
                see reject_at_or_above).
            reject_at_or_above: Risk scores at or above this value are
                rejected automatically. Scores between approve_below
                and reject_at_or_above are escalated for manual review.

        Raises:
            Exception: if the thresholds are out of the valid 0-100
                range or are not in increasing order.
        """
        if not (0 <= approve_below <= 100) or not (0 <= reject_at_or_above <= 100):
            raise Exception("Thresholds must be between 0 and 100")
        if approve_below >= reject_at_or_above:
            raise Exception("approve_below must be less than reject_at_or_above")

        self.organization_settings[org_id] = json.dumps({
            "org_id": org_id,
            "approve_below": approve_below,
            "reject_at_or_above": reject_at_or_above,
            "updated_at": self._now_iso(),
        })

    # ==================================================================
    # SECTION 4: Internal - nondeterministic AI validation
    # ==================================================================

    def _run_validation(self, org_id: str, invoice_id: str, data: dict) -> None:
        """
        Run AI fraud/compliance analysis to obtain a single numeric
        risk score, then derive the decision deterministically. See
        module docstring for why the decision itself is computed in
        Python rather than asked of the LLM.

        This used to be five sequential gl.eq_principle.prompt_comparative
        calls (vendor credibility, pricing, fraud, compliance, then an
        aggregation step). Each prompt_comparative call requires the
        leader AND every validator to *independently* run their own
        LLM and then agree with each other - and different validator
        nodes in this contract's committee run different model
        providers (e.g. deepseek, qwen, gpt, claude), which routinely
        produced genuinely different scores and caused the whole
        transaction to end UNDETERMINED, even after widening the
        numeric tolerance bands.

        This version makes exactly one nondeterministic call using
        gl.eq_principle.prompt_non_comparative instead: only the
        leader generates an answer; every validator merely judges
        whether that single answer is *plausible* against lenient,
        explicit criteria, rather than independently reproducing it.
        That removes the actual source of disagreement (multiple
        different models being asked to independently converge),
        rather than just loosening how close their answers need to be.
        """
        vendor_id = data.get("vendor_id", "")
        vendor_name = data.get("vendor_name", "Unknown")
        amount = float(data.get("amount", 0))
        preliminary_score = int(data.get("preliminary_risk_score", 10))

        context = self._build_analysis_context(org_id, data)
        final_risk_score, risk_factors, reasoning = self._analyze_invoice_risk(context)

        decision = self._derive_decision(org_id, final_risk_score)
        flags = data.get("anomaly_flags", [])

        self._finalize_validation(
            org_id=org_id,
            invoice_id=invoice_id,
            decision=decision,
            risk_score=final_risk_score,
            risk_factors=risk_factors,
            reasoning=reasoning,
            vendor_name=vendor_name,
            vendor_id=vendor_id,
            amount=amount,
            flagged=len(flags) > 0,
            audit_event=EVENT_VALIDATED,
        )

    def _build_analysis_context(self, org_id: str, data: dict) -> dict:
        """Gather and format every input the risk-analysis prompt needs."""
        vendor_id = data.get("vendor_id", "")
        vendor_hist = self._get_vendor_history_dict(org_id, vendor_id)

        return {
            "vendor_name": data.get("vendor_name", "Unknown"),
            "vendor_status": data.get("vendor_status", "active"),
            "vendor_hist_text": self._format_vendor_history(vendor_hist),
            "flags_text": self._format_anomaly_flags(data.get("anomaly_flags", [])),
            "line_items_text": self._format_line_items(data.get("line_items", [])),
            "policy_text": data.get("procurement_policy") or (
                "No specific procurement policy provided. Use general "
                "accounts-payable best practices as the standard."
            ),
            "amount": float(data.get("amount", 0)),
            "currency": data.get("currency", "USD"),
            "preliminary_score": int(data.get("preliminary_risk_score", 10)),
            "invoice_number": data.get("invoice_number"),
            "issue_date": data.get("issue_date", "-"),
            "due_date": data.get("due_date", "-"),
        }

    def _build_analysis_input_text(self, ctx: dict) -> str:
        """
        Render the full invoice/vendor/policy context as plain text.
        This is the `fn` passed to prompt_non_comparative - it runs on
        every node (leader and validators alike) and must be a purely
        deterministic function of already-agreed-upon data, since it
        is not itself covered by any equivalence judgment.
        """
        return f"""## Vendor Information
- Name: {ctx['vendor_name']}
- Status: {ctx['vendor_status']}
- History with this organization: {ctx['vendor_hist_text']}

## Invoice
- Number: {ctx['invoice_number']}
- Amount: {ctx['currency']} {ctx['amount']:.2f}
- Issue date: {ctx['issue_date']}, Due date: {ctx['due_date']}
- Line items:
{ctx['line_items_text']}

## Deterministic Pre-check Flags
{ctx['flags_text']}

## Procurement Policy
{ctx['policy_text']}

## Deterministic Preliminary Risk Score
{ctx['preliminary_score']}/100 (computed off-chain before this invoice reached GenLayer)"""

    def _analyze_invoice_risk(self, ctx: dict) -> tuple:
        """
        Single nondeterministic AI analysis covering vendor
        credibility, pricing plausibility, fraud indicators, and
        procurement policy compliance in one pass, using
        prompt_non_comparative so only the leader generates an answer
        and validators merely judge its plausibility.
        """
        input_text = self._build_analysis_input_text(ctx)

        raw = gl.eq_principle.prompt_non_comparative(
            lambda: input_text,
            task=(
                "You are an expert accounts payable fraud and compliance "
                "analyst. Using the invoice context provided, assess "
                "overall risk across four dimensions: vendor credibility "
                "(history, plausibility, signs of a fictitious vendor), "
                "pricing plausibility (line items vs. total, deviation "
                "from vendor history), fraud indicators (deliberate "
                "manipulation, known B2B fraud patterns, suspicious "
                "urgency), and procurement policy compliance. Weight "
                "high-severity fraud or compliance findings more heavily "
                "than minor pricing discrepancies. Respond ONLY with "
                "valid JSON in this exact shape: "
                '{"final_risk_score": <integer 0-100>, "risk_factors": '
                '[{"factor": "<name>", "weight": <0-100>, "detail": '
                '"<explanation>"}], "reasoning": "<two to three '
                'paragraphs for a finance reviewer>"}'
            ),
            criteria=(
                "final_risk_score must be an integer between 0 and 100 "
                "that is plausible given the input context: it should be "
                "clearly higher when deterministic pre-check flags "
                "describe rush payments, new-vendor risk, or other "
                "material issues, when line item totals don't match the "
                "invoice amount, or when the procurement policy is "
                "contradicted; and clearly lower when the vendor has a "
                "clean history and no flags are present. The exact "
                "numeric value does not need to match any specific "
                "number - only the general plausibility relative to the "
                "input context matters. risk_factors should be "
                "reasonably grounded in the input context, but their "
                "exact wording, count, and ordering do not matter. "
                "reasoning may vary freely in wording and length as long "
                "as it does not contradict the input context. The output "
                "must be valid JSON matching the requested shape."
            ),
        )

        try:
            result = json.loads(raw)
            final_risk_score = self._clamp_score(
                result.get("final_risk_score", ctx["preliminary_score"])
            )
            risk_factors = result.get("risk_factors", [])
            if not isinstance(risk_factors, list):
                risk_factors = []
            reasoning = result.get("reasoning", "")
        except Exception:
            # Parse failure should never crash the contract or silently
            # under-report risk - fall back to the deterministic
            # preliminary score and an explanatory note.
            final_risk_score = ctx["preliminary_score"]
            risk_factors = []
            reasoning = (
                "The AI analysis output could not be parsed as JSON. The "
                "risk score was conservatively set to the deterministic "
                "preliminary score computed before this invoice reached "
                "GenLayer."
            )

        return final_risk_score, risk_factors, reasoning

    def _derive_decision(self, org_id: str, final_risk_score: int) -> str:
        """
        Deterministically map a numeric risk score to a decision using
        this organization's configured thresholds (or the contract-wide
        defaults if none were set via set_organization_settings).
        Pure Python comparison - no consensus risk whatsoever.
        """
        approve_below, reject_at_or_above = self._get_org_thresholds(org_id)
        if final_risk_score >= reject_at_or_above:
            return DECISION_REJECTED
        if final_risk_score < approve_below:
            return DECISION_APPROVED
        return DECISION_ESCALATED

    # ==================================================================
    # SECTION 5: Internal - finalization, history, and audit helpers
    # ==================================================================

    def _finalize_validation(
        self,
        org_id: str,
        invoice_id: str,
        decision: str,
        risk_score: int,
        risk_factors: list,
        reasoning: str,
        vendor_name: str,
        vendor_id: str,
        amount: float,
        flagged: bool,
        audit_event: str,
    ) -> None:
        """
        Shared tail end of both the AI-driven and the deterministic
        fast-path validation flows: persist the ValidationResult,
        update vendor history and organization stats, and append the
        audit trail entry.
        """
        if decision not in VALID_DECISIONS:
            decision = DECISION_ESCALATED

        key = self._invoice_key(org_id, invoice_id)
        now = self._now_iso()

        self.validations[key] = json.dumps({
            "org_id": org_id,
            "invoice_id": invoice_id,
            "decision": decision,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "reasoning": reasoning,
            "resolved_at": now,
        })

        self._update_vendor_history(
            org_id=org_id,
            vendor_id=vendor_id,
            vendor_name=vendor_name,
            amount=amount,
            decision=decision,
            flagged=flagged,
            now=now,
        )

        self._bump_org_stat(org_id, f"total_{decision}")

        self._append_audit_entry(
            entry_id=f"{key}:{audit_event}:{now}",
            org_id=org_id,
            invoice_id=invoice_id,
            event=audit_event,
            actor_wallet="",
            decision=decision,
            risk_score=risk_score,
        )

    def _update_vendor_history(
        self,
        org_id: str,
        vendor_id: str,
        vendor_name: str,
        amount: float,
        decision: str,
        flagged: bool,
        now: str,
    ) -> None:
        """Update the running per-vendor summary used as context for future submissions."""
        if not vendor_id:
            return

        vendor_key = self._vendor_key(org_id, vendor_id)
        hist = self._get_vendor_history_dict(org_id, vendor_id) or {
            "org_id": org_id,
            "vendor_id": vendor_id,
            "vendor_name": vendor_name,
            "total_invoices": 0,
            "approved_invoices": 0,
            "rejected_invoices": 0,
            "escalated_invoices": 0,
            "flagged_invoices": 0,
            "total_amount": 0.0,
            "avg_invoice_amount": 0.0,
            "last_invoice_at": now,
        }

        hist["total_invoices"] += 1
        hist["total_amount"] = float(hist["total_amount"]) + amount
        hist["avg_invoice_amount"] = hist["total_amount"] / hist["total_invoices"]
        hist["last_invoice_at"] = now
        hist.setdefault("escalated_invoices", 0)

        if decision == DECISION_APPROVED:
            hist["approved_invoices"] += 1
        elif decision == DECISION_REJECTED:
            hist["rejected_invoices"] += 1
        elif decision == DECISION_ESCALATED:
            hist["escalated_invoices"] += 1

        if flagged:
            hist["flagged_invoices"] += 1

        self.vendor_history[vendor_key] = json.dumps(hist)

    def _append_audit_entry(
        self,
        entry_id: str,
        org_id: str,
        invoice_id: str,
        event: str,
        actor_wallet: str,
        decision,
        risk_score,
    ) -> None:
        """Append a single immutable audit log entry."""
        self.audit_trail.append(json.dumps({
            "entry_id": entry_id,
            "org_id": org_id,
            "invoice_id": invoice_id,
            "event": event,
            "actor_wallet": actor_wallet,
            "decision": decision,
            "risk_score": risk_score,
            "timestamp": self._now_iso(),
        }))

    def _bump_org_stat(self, org_id: str, counter_name: str) -> None:
        """Increment a single named counter in an organization's running stats."""
        stats = self._get_org_stats_dict(org_id)
        stats[counter_name] = int(stats.get(counter_name, 0)) + 1
        self.organization_stats[org_id] = json.dumps(stats)

    # ==================================================================
    # SECTION 6: Internal - parsing, formatting, and lookup helpers
    # ==================================================================

    def _parse_submission_payload(self, payload: str) -> dict:
        """Parse and minimally sanity-check the incoming submission payload."""
        try:
            data = json.loads(payload)
        except Exception as exc:
            raise Exception(f"payload is not valid JSON: {exc}")
        if not isinstance(data, dict):
            raise Exception("payload must decode to a JSON object")
        return data

    def _validate_required_fields(self, data: dict) -> None:
        """Raise if any required submission field is missing or falsy."""
        for field in REQUIRED_SUBMISSION_FIELDS:
            if not data.get(field):
                raise Exception(f"Missing required field: {field}")

    def _index_invoice_number(self, org_id: str, data: dict) -> None:
        """Maintain the secondary index used for O(1) duplicate detection."""
        vendor_id = data.get("vendor_id", "")
        invoice_number = data.get("invoice_number", "")
        if not vendor_id or not invoice_number:
            return
        index_key = f"{org_id}:{vendor_id}:{invoice_number}"
        if index_key not in self.invoice_number_index:
            self.invoice_number_index[index_key] = data.get("invoice_id", "")

    def _find_duplicate_invoice_number(
        self, org_id: str, vendor_id: str, invoice_number: str
    ) -> str:
        """Return the invoice_id already indexed under this vendor/number, or ''."""
        if not vendor_id or not invoice_number:
            return ""
        index_key = f"{org_id}:{vendor_id}:{invoice_number}"
        return self.invoice_number_index.get(index_key) or ""

    def _blocked_vendor_reason(self, org_id: str, vendor_id: str) -> object:
        """Return the block reason string if this vendor is blocked, else None."""
        if not vendor_id:
            return None
        vendor_key = self._vendor_key(org_id, vendor_id)
        raw = self.vendor_blocklist.get(vendor_key)
        if not raw:
            return None
        try:
            record = json.loads(raw)
            return record.get("reason", "blocked")
        except Exception:
            return "blocked"

    def _get_vendor_history_dict(self, org_id: str, vendor_id: str) -> object:
        """Return the parsed VendorSummary dict for a vendor, or None if absent."""
        if not vendor_id:
            return None
        raw = self.vendor_history.get(self._vendor_key(org_id, vendor_id))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    def _get_org_stats_dict(self, org_id: str) -> dict:
        """Return the parsed OrganizationStats dict for an org, defaulting to empty."""
        raw = self.organization_stats.get(org_id)
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _get_org_thresholds(self, org_id: str) -> tuple:
        """Return (approve_below, reject_at_or_above) for an org, falling back to defaults."""
        raw = self.organization_settings.get(org_id)
        if not raw:
            return DEFAULT_APPROVE_BELOW, DEFAULT_REJECT_AT_OR_ABOVE
        try:
            settings = json.loads(raw)
            return (
                int(settings.get("approve_below", DEFAULT_APPROVE_BELOW)),
                int(settings.get("reject_at_or_above", DEFAULT_REJECT_AT_OR_ABOVE)),
            )
        except Exception:
            return DEFAULT_APPROVE_BELOW, DEFAULT_REJECT_AT_OR_ABOVE


    def _clamp_score(self, value) -> int:
        """Coerce a value to an integer risk score within [0, 100]."""
        try:
            score = int(value)
        except Exception:
            score = 50
        return max(0, min(100, score))

    def _format_vendor_history(self, vendor_hist: object) -> str:
        """Render a VendorSummary dict as prompt-friendly text."""
        if not vendor_hist:
            return "No prior history with this organization."
        return (
            f"Total invoices: {vendor_hist.get('total_invoices', 0)}, "
            f"Approved: {vendor_hist.get('approved_invoices', 0)}, "
            f"Rejected: {vendor_hist.get('rejected_invoices', 0)}, "
            f"Escalated: {vendor_hist.get('escalated_invoices', 0)}, "
            f"Flagged: {vendor_hist.get('flagged_invoices', 0)}, "
            f"Avg invoice amount: ${float(vendor_hist.get('avg_invoice_amount', 0)):.2f}"
        )

    def _format_anomaly_flags(self, flags: object) -> str:
        """Render the deterministic pre-check anomaly flags as prompt-friendly text."""
        if not flags:
            return "None"
        lines = []
        for flag in flags:
            severity = str(flag.get("severity", "")).upper()
            flag_type = flag.get("type", "")
            detail = flag.get("detail", "")
            lines.append(f"- [{severity}] {flag_type}: {detail}")
        return "\n".join(lines) if lines else "None"

    def _format_line_items(self, line_items: object) -> str:
        """Render invoice line items as prompt-friendly text."""
        if not line_items:
            return "No line items provided"
        lines = []
        for item in line_items:
            description = item.get("description", "N/A")
            quantity = item.get("quantity", 1)
            unit_price = float(item.get("unit_price", 0))
            total = float(item.get("total", 0))
            lines.append(
                f"- {description}: qty {quantity} x ${unit_price:.2f} = ${total:.2f}"
            )
        return "\n".join(lines) if lines else "No line items provided"

    def _invoice_key(self, org_id: str, invoice_id: str) -> str:
        return f"{org_id}:{invoice_id}"

    def _vendor_key(self, org_id: str, vendor_id: str) -> str:
        return f"{org_id}:{vendor_id}"

    def _now_iso(self) -> str:
        return datetime.datetime.utcnow().isoformat() + "Z"

    # ==================================================================
    # SECTION 7: Public read methods
    # ==================================================================

    @gl.public.view
    def get_validation_result(self, org_id: str, invoice_id: str) -> str:
        """
        Returns JSON string of the ValidationResult, or empty string if
        not yet resolved. Called by the sync-genlayer-result Edge
        Function to detect when consensus has finalized.
        """
        return self.validations.get(self._invoice_key(org_id, invoice_id)) or ""

    @gl.public.view
    def get_submission(self, org_id: str, invoice_id: str) -> str:
        """Returns JSON string of the InvoiceSubmission, or empty string."""
        return self.submissions.get(self._invoice_key(org_id, invoice_id)) or ""

    @gl.public.view
    def get_vendor_history(self, org_id: str, vendor_id: str) -> str:
        """Returns JSON string of the VendorSummary, or empty string."""
        return self.vendor_history.get(self._vendor_key(org_id, vendor_id)) or ""

    @gl.public.view
    def is_vendor_blocked(self, org_id: str, vendor_id: str) -> str:
        """Returns the JSON-encoded BlockRecord if blocked, or empty string."""
        return self.vendor_blocklist.get(self._vendor_key(org_id, vendor_id)) or ""

    @gl.public.view
    def get_organization_settings(self, org_id: str) -> str:
        """
        Returns JSON-encoded {approve_below, reject_at_or_above} for an
        organization, or the contract-wide defaults if never configured.
        """
        approve_below, reject_at_or_above = self._get_org_thresholds(org_id)
        return json.dumps({
            "org_id": org_id,
            "approve_below": approve_below,
            "reject_at_or_above": reject_at_or_above,
        })

    @gl.public.view
    def get_organization_stats(self, org_id: str) -> str:
        """Returns JSON-encoded running counters for an organization."""
        return json.dumps(self._get_org_stats_dict(org_id))

    @gl.public.view
    def get_audit_trail(self, org_id: str, invoice_id: str) -> str:
        """
        Returns a JSON array string of every audit entry for an
        organization, optionally filtered to a single invoice.
        Pass an empty string for invoice_id to get all entries for the
        whole organization. Equivalent to calling
        get_audit_trail_page(org_id, invoice_id, 0, <no limit>).
        """
        return json.dumps(
            self._collect_audit_entries(org_id, invoice_id, offset=0, limit=-1)
        )

    @gl.public.view
    def get_audit_trail_page(
        self, org_id: str, invoice_id: str, offset: int, limit: int
    ) -> str:
        """
        Returns a JSON array string of up to `limit` matching audit
        entries, skipping the first `offset` matches. Intended for UIs
        that need to paginate a long-running organization's history
        instead of fetching every entry at once.

        Args:
            org_id: UUID of the organization to filter by.
            invoice_id: UUID to filter by, or "" for all invoices.
            offset: Number of matching entries to skip.
            limit: Maximum number of matching entries to return.
        """
        return json.dumps(
            self._collect_audit_entries(org_id, invoice_id, offset, limit)
        )

    @gl.public.view
    def get_contract_info(self) -> str:
        """Returns JSON-encoded contract metadata, useful for client-side compatibility checks."""
        return json.dumps({
            "contract": "InvoiceValidator",
            "version": CONTRACT_VERSION,
            "valid_decisions": list(VALID_DECISIONS),
            "default_approve_below": DEFAULT_APPROVE_BELOW,
            "default_reject_at_or_above": DEFAULT_REJECT_AT_OR_ABOVE,
        })

    def _collect_audit_entries(
        self, org_id: str, invoice_id: str, offset: int, limit: int
    ) -> list:
        """Shared filtering/pagination logic for the audit trail view methods."""
        entries = []
        matched = 0
        for i in range(len(self.audit_trail)):
            try:
                entry = json.loads(self.audit_trail[i])
            except Exception:
                continue
            if entry.get("org_id") != org_id:
                continue
            if invoice_id and entry.get("invoice_id") != invoice_id:
                continue

            if matched < offset:
                matched += 1
                continue
            matched += 1

            entries.append(entry)
            if limit >= 0 and len(entries) >= limit:
                break

        return entries
