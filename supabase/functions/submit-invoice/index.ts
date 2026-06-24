import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface SubmitInvoicePayload {
  vendor_id: string;
  vendor_name?: string; // provided when vendor_id = "new"
  invoice_number: string;
  amount: number;
  currency?: string;
  issue_date: string;
  due_date: string;
  file_path: string;
  file_hash: string;
  line_items: LineItem[];
  po_id?: string;
}

interface AnomalyFlag {
  type: string;
  severity: "low" | "medium" | "high";
  detail: string;
}

const DAYS_MS = 86_400_000;

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAYS_MS;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: SubmitInvoicePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { vendor_id, vendor_name, invoice_number, amount, issue_date, due_date, file_path, file_hash, line_items, po_id } = payload;

  if (!invoice_number || !amount || !issue_date || !due_date || !file_path || !file_hash) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Resolve org membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !["finance_reviewer", "admin", "owner"].includes(membership.role)) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to submit invoices" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = membership.org_id;

  // Resolve or create vendor
  let resolvedVendorId = vendor_id;
  if (vendor_id === "new") {
    if (!vendor_name?.trim()) {
      return new Response(JSON.stringify({ error: "vendor_name is required when vendor_id is 'new'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: newVendor, error: vendorErr } = await supabase
      .from("vendors")
      .insert({ org_id: orgId, name: vendor_name.trim(), status: "active" })
      .select("id")
      .single();
    if (vendorErr || !newVendor) {
      return new Response(JSON.stringify({ error: "Failed to create vendor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    resolvedVendorId = newVendor.id;
  }

  // Fetch org settings + vendor info + reputation in parallel
  const [orgResult, vendorResult, reputationResult, dupeDocResult, dupeInvResult] = await Promise.all([
    supabase.from("organizations").select("risk_threshold").eq("id", orgId).single(),
    supabase.from("vendors").select("name, status").eq("id", resolvedVendorId).eq("org_id", orgId).single(),
    supabase.from("vendor_reputation").select("total_invoices, flagged_invoices, avg_price_variance_pct").eq("vendor_id", resolvedVendorId).maybeSingle(),
    // Duplicate document check (same file hash in this org)
    supabase.from("invoices").select("id, invoice_number").eq("org_id", orgId).eq("file_hash", file_hash).maybeSingle(),
    // Duplicate invoice number check (same vendor + org + number)
    supabase.from("invoices").select("id").eq("org_id", orgId).eq("vendor_id", resolvedVendorId).eq("invoice_number", invoice_number).maybeSingle(),
  ]);

  const orgRiskThreshold = orgResult.data?.risk_threshold ?? 70;
  const vendor = vendorResult.data;
  const reputation = reputationResult.data;

  // --- Deterministic pre-checks ---
  const flags: AnomalyFlag[] = [];
  let score = 10;

  // 1. Duplicate document
  if (dupeDocResult.data) {
    flags.push({
      type: "duplicate_document",
      severity: "high",
      detail: `This document was already submitted as invoice ${dupeDocResult.data.invoice_number}.`,
    });
    score += 40;
  }

  // 2. Duplicate invoice number
  if (dupeInvResult.data) {
    flags.push({
      type: "duplicate_invoice_number",
      severity: "high",
      detail: `Invoice number ${invoice_number} already exists for this vendor.`,
    });
    score += 50;
  }

  // 3. Line item total mismatch
  const lineTotal = line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  if (line_items.length > 0 && Math.abs(lineTotal - amount) > 0.01) {
    flags.push({
      type: "line_item_mismatch",
      severity: "medium",
      detail: `Line items total $${lineTotal.toFixed(2)} but invoice amount is $${amount.toFixed(2)}.`,
    });
    score += 25;
  }

  // 4. Price variance from vendor history
  const priceVariancePct = reputation?.avg_price_variance_pct ?? 0;
  if (priceVariancePct > 20) {
    flags.push({
      type: "price_variance",
      severity: priceVariancePct > 40 ? "high" : "medium",
      detail: `${vendor?.name ?? "Vendor"} has a historical price variance of ${priceVariancePct.toFixed(1)}%.`,
    });
    score += priceVariancePct > 40 ? 35 : 20;
  }

  // 5. Vendor under review
  if (vendor?.status === "under_review") {
    flags.push({
      type: "vendor_under_review",
      severity: "high",
      detail: `${vendor.name} is currently under review.`,
    });
    score += 20;
  }

  // 6. Rush payment (due within 7 days of issue)
  const paymentDays = daysBetween(issue_date, due_date);
  if (paymentDays >= 0 && paymentDays < 7) {
    flags.push({
      type: "rush_payment",
      severity: "medium",
      detail: `Payment due ${paymentDays === 0 ? "same day" : `in ${paymentDays} day${paymentDays === 1 ? "" : "s"}`} - unusually short payment window.`,
    });
    score += 15;
  }

  // 7. New vendor with no history and large invoice
  if (!reputation || reputation.total_invoices === 0) {
    flags.push({
      type: "new_vendor",
      severity: "low",
      detail: `${vendor?.name ?? "Vendor"} has no prior invoice history with this organization.`,
    });
    score += 10;
  }

  const preliminaryRiskScore = Math.min(score, 100);
  const duplicateFlag = !!(dupeDocResult.data || dupeInvResult.data);
  const poMatchFlag = !!po_id;

  // --- Persist invoice ---
  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoices")
    .insert({
      org_id: orgId,
      vendor_id: resolvedVendorId,
      po_id: po_id ?? null,
      invoice_number,
      amount,
      currency: payload.currency ?? "USD",
      issue_date,
      due_date,
      file_path,
      file_hash,
      status: "pending",
      preliminary_risk_score: preliminaryRiskScore,
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (invoiceErr || !invoice) {
    return new Response(JSON.stringify({ error: invoiceErr?.message ?? "Failed to create invoice" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const invoiceId = invoice.id;

  // --- Persist line items and analysis in parallel ---
  await Promise.all([
    line_items.length > 0
      ? supabase.from("invoice_line_items").insert(
          line_items.map((item) => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          }))
        )
      : Promise.resolve(),
    supabase.from("invoice_analysis").insert({
      invoice_id: invoiceId,
      duplicate_flag: duplicateFlag,
      po_match_flag: poMatchFlag,
      price_variance_pct: priceVariancePct > 0 ? priceVariancePct : null,
      payment_timing_flag: paymentDays >= 0 && paymentDays < 7,
      anomaly_flags: flags,
      preliminary_explanation: flags.length === 0
        ? "No anomalies detected in the deterministic pre-checks."
        : `${flags.length} anomaly flag${flags.length === 1 ? "" : "s"} detected: ${flags.map((f) => f.type).join(", ")}.`,
    }),
    supabase.from("audit_logs").insert({
      org_id: orgId,
      actor_id: userData.user.id,
      action: "invoice.submitted",
      entity_type: "invoice",
      entity_id: invoiceId,
      metadata: {
        invoice_number,
        amount,
        vendor_id: resolvedVendorId,
        preliminary_risk_score: preliminaryRiskScore,
        flag_count: flags.length,
      },
    }),
  ]);

  // Fire-and-forget email notification
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      event: "invoice.submitted",
      org_id: orgId,
      invoice_id: invoiceId,
      details: {
        invoice_number: invoice_number,
        vendor: vendor?.name ?? resolvedVendorId,
        amount: `${payload.currency ?? "USD"} ${amount.toLocaleString()}`,
        risk_score: preliminaryRiskScore,
        flags: flags.length,
      },
    }),
  }).catch(() => {});

  return new Response(
    JSON.stringify({
      invoice_id: invoiceId,
      preliminary_risk_score: preliminaryRiskScore,
      anomaly_flags: flags,
      auto_submit_to_genlayer: preliminaryRiskScore >= orgRiskThreshold,
      risk_threshold: orgRiskThreshold,
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
