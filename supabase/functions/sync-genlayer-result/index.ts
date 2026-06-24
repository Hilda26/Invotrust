// sync-genlayer-result Edge Function
// Polls get_validation_result on the InvoiceValidator contract and syncs consensus
// results back to Supabase: genlayer_validations, invoices.final_risk_score + status,
// vendor_reputation, audit_logs.
//
// Can be called:
//   - As a webhook from GenLayer (when consensus is finalized), OR
//   - On a cron schedule to catch any missed notifications, OR
//   - Manually (GET /functions/v1/sync-genlayer-result?invoice_id=<id>)
//
// Supports both GET (query param) and POST (JSON body) with invoice_id.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { createClient as createGenLayerClient, chains } from "npm:genlayer-js@1.1.8";

const GENLAYER_RPC_URL = Deno.env.get("GENLAYER_RPC_URL");

const genLayerClient = createGenLayerClient({
  chain: chains.studionet,
  ...(GENLAYER_RPC_URL ? { endpoint: GENLAYER_RPC_URL } : {}),
});

interface ValidationResult {
  decision: "approved" | "rejected" | "escalated";
  risk_score: number;
  risk_factors: Array<{ factor: string; weight: number; detail: string }>;
  reasoning: string;
  resolved_at: string;
}

Deno.serve(async (req) => {
  const contractAddress = Deno.env.get("GENLAYER_CONTRACT_ADDRESS");
  if (!contractAddress) {
    return new Response(
      JSON.stringify({ error: "GENLAYER_CONTRACT_ADDRESS not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // This function is called server-to-server (pg_cron or manual trigger).
  // Two accepted callers:
  //   1. pg_cron: no Authorization header, x-supabase-internal: 1 header set
  //   2. Manual/admin: Authorization: Bearer <service_role_key>
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isCron = req.headers.get("x-supabase-internal") === "1";
  const isServiceKey = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isCron && !isServiceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
  );

  // Resolve invoice_id from query param or JSON body
  let invoiceId: string | null = null;
  const url = new URL(req.url);
  invoiceId = url.searchParams.get("invoice_id");

  if (!invoiceId && req.method === "POST") {
    try {
      const body = await req.json() as { invoice_id?: string };
      invoiceId = body.invoice_id ?? null;
    } catch {
      // no body or non-JSON - will process all pending below
    }
  }

  // If no specific invoice_id, sync ALL pending validations (cron mode)
  let pendingRows: Array<{ invoice_id: string; org_id: string; tx_hash: string }> = [];

  if (invoiceId) {
    const { data } = await supabase
      .from("genlayer_validations")
      .select("invoice_id, org_id, tx_hash")
      .eq("invoice_id", invoiceId)
      .eq("status", "pending")
      .maybeSingle();
    if (data) pendingRows = [data];
  } else {
    const { data } = await supabase
      .from("genlayer_validations")
      .select("invoice_id, org_id, tx_hash")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(50);
    pendingRows = data ?? [];
  }

  if (pendingRows.length === 0) {
    return new Response(
      JSON.stringify({ synced: 0, message: "No pending validations to sync." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: Array<{ invoice_id: string; outcome: string }> = [];

  for (const row of pendingRows) {
    try {
      // Call get_validation_result on the contract (read-only). The
      // contract method returns a JSON-encoded string (or "" if not
      // yet resolved), not a parsed object - it must be JSON.parse'd.
      const rawResult = await genLayerClient.readContract({
        address: contractAddress as `0x${string}`,
        functionName: "get_validation_result",
        args: [row.org_id, row.invoice_id],
      }) as string | null;

      if (!rawResult) {
        // Still pending - consensus not reached yet
        results.push({ invoice_id: row.invoice_id, outcome: "still_pending" });
        continue;
      }

      const result = JSON.parse(rawResult) as ValidationResult;

      const decision = result.decision;
      const riskScore = result.risk_score;
      const invoiceStatus = decision === "approved"
        ? "approved"
        : decision === "rejected"
          ? "rejected"
          : "escalated";

      // Persist validation result and update invoice in parallel
      await Promise.all([
        supabase
          .from("genlayer_validations")
          .update({
            status: "confirmed",
            decision,
            risk_score: riskScore,
            risk_factors: result.risk_factors,
            reasoning: result.reasoning,
            confirmed_at: result.resolved_at ?? new Date().toISOString(),
          })
          .eq("invoice_id", row.invoice_id)
          .eq("org_id", row.org_id),

        supabase
          .from("invoices")
          .update({
            final_risk_score: riskScore,
            status: invoiceStatus,
          })
          .eq("id", row.invoice_id)
          .eq("org_id", row.org_id),

        supabase.from("audit_logs").insert({
          org_id: row.org_id,
          actor_id: null, // system / consensus
          action: "genlayer.consensus_received",
          entity_type: "invoice",
          entity_id: row.invoice_id,
          metadata: {
            decision,
            final_risk_score: riskScore,
            tx_hash: row.tx_hash,
            contract_address: contractAddress,
          },
        }),
      ]);

      // Update vendor_reputation based on GenLayer decision
      // Fetch vendor_id from invoice
      const { data: inv } = await supabase
        .from("invoices")
        .select("vendor_id, invoice_analysis(price_variance_pct)")
        .eq("id", row.invoice_id)
        .maybeSingle();

      if (inv?.vendor_id) {
        const priceVariancePct = (inv.invoice_analysis as { price_variance_pct?: number } | null)
          ?.price_variance_pct ?? 0;

        // Upsert vendor_reputation using raw SQL via rpc to handle rolling averages atomically
        await supabase.rpc("upsert_vendor_reputation", {
          p_vendor_id: inv.vendor_id,
          p_org_id: row.org_id,
          p_flagged: decision !== "approved",
          p_price_variance_pct: priceVariancePct,
        });
      }

      // Fire-and-forget email notification to org owners/admins
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          event: "genlayer.consensus_received",
          org_id: row.org_id,
          invoice_id: row.invoice_id,
          details: {
            decision,
            final_risk_score: riskScore,
            invoice_id: row.invoice_id,
          },
        }),
      }).catch(() => {});

      results.push({ invoice_id: row.invoice_id, outcome: decision });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error syncing invoice ${row.invoice_id}:`, message);
      results.push({ invoice_id: row.invoice_id, outcome: `error: ${message}` });
    }
  }

  return new Response(
    JSON.stringify({ synced: results.length, results }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
