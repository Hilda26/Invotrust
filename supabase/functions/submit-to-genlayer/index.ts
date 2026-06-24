// submit-to-genlayer Edge Function
// Called after submit-invoice when auto_submit_to_genlayer = true, or manually.
// Fetches invoice data + user wallet, signs and calls InvoiceValidator.submit_invoice
// on GenLayer StudioNet.
//
// IMPORTANT: GENLAYER_CONTRACT_ADDRESS must be set in Edge Function secrets after deployment.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { createClient as createGenLayerClient, createAccount, chains } from "npm:genlayer-js@1.1.8";
import { decryptPrivateKey, type EncryptedPrivateKey } from "../_shared/encryption.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

// GenLayer JSON-RPC endpoint for StudioNet - overrides the chain's default if set
const GENLAYER_RPC_URL = Deno.env.get("GENLAYER_RPC_URL");

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const contractAddress = Deno.env.get("GENLAYER_CONTRACT_ADDRESS");
  if (!contractAddress) {
    return new Response(
      JSON.stringify({ error: "GENLAYER_CONTRACT_ADDRESS is not configured. Deploy the InvoiceValidator contract to StudioNet first." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let invoiceId: string;
  try {
    ({ invoice_id: invoiceId } = await req.json() as { invoice_id: string });
    if (!invoiceId) throw new Error("missing invoice_id");
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be JSON with invoice_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify membership and fetch org details in parallel
  const [memberResult, invoiceResult] = await Promise.all([
    supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, amount, currency, issue_date, due_date, status, preliminary_risk_score, file_hash, vendor_id, vendors(name, status), invoice_line_items(description, quantity, unit_price, total), invoice_analysis(anomaly_flags)",
      )
      .eq("id", invoiceId)
      .maybeSingle(),
  ]);

  if (!memberResult.data || !["finance_reviewer", "admin", "owner"].includes(memberResult.data.role)) {
    return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = memberResult.data.org_id;

  if (!invoiceResult.data) {
    return new Response(JSON.stringify({ error: "Invoice not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const invoice = invoiceResult.data;

  // Verify the invoice belongs to this org
  const { data: orgCheck } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!orgCheck) {
    return new Response(JSON.stringify({ error: "Invoice not found in your organization" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (invoice.status === "approved" || invoice.status === "rejected") {
    return new Response(
      JSON.stringify({ error: `Invoice is already ${invoice.status}. Cannot submit to GenLayer.` }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Check for existing pending GenLayer validation
  const { data: existingValidation } = await supabase
    .from("genlayer_validations")
    .select("id, status")
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingValidation && existingValidation.status === "pending") {
    return new Response(
      JSON.stringify({ error: "A GenLayer validation is already pending for this invoice." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Fetch org procurement policy and wallet
  const [orgResult, walletResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("procurement_policy, risk_threshold")
      .eq("id", orgId)
      .single(),
    supabase
      .from("user_wallets")
      .select("wallet_address, encrypted_private_key")
      .eq("user_id", userData.user.id)
      .maybeSingle(),
  ]);

  if (!walletResult.data) {
    return new Response(
      JSON.stringify({ error: "No wallet found for your account. Check Settings > Wallet." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const wallet = walletResult.data;

  // Decrypt private key using envelope encryption
  let privateKeyHex: string;
  try {
    const encryptedPayload: EncryptedPrivateKey = JSON.parse(wallet.encrypted_private_key);
    const privateKeyBytes = await decryptPrivateKey(encryptedPayload);
    privateKeyHex = `0x${toHex(privateKeyBytes)}`;
  } catch {
    return new Response(JSON.stringify({ error: "Failed to decrypt wallet private key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build the payload for the GenLayer contract
  const vendor = invoice.vendors as { name: string; status: string } | null;
  const anomalyFlags = Array.isArray(invoice.invoice_analysis?.anomaly_flags)
    ? invoice.invoice_analysis!.anomaly_flags
    : [];

  const contractPayload = {
    invoice_number: invoice.invoice_number,
    amount: Number(invoice.amount),
    currency: invoice.currency ?? "USD",
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    vendor_id: invoice.vendor_id,
    vendor_name: vendor?.name ?? "Unknown",
    vendor_status: vendor?.status ?? "active",
    line_items: (invoice.invoice_line_items ?? []).map((li: {
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
    }) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
    })),
    anomaly_flags: anomalyFlags,
    preliminary_risk_score: invoice.preliminary_risk_score ?? 10,
    procurement_policy: orgResult.data?.procurement_policy ?? "",
    submitter_wallet: wallet.wallet_address,
  };

  // Call GenLayer contract via JSON-RPC
  // submit_invoice takes (org_id: str, invoice_id: str, payload: str) - payload is JSON string
  let txHash: string;
  try {
    const account = createAccount(privateKeyHex as `0x${string}`);
    const client = createGenLayerClient({
      chain: chains.studionet,
      ...(GENLAYER_RPC_URL ? { endpoint: GENLAYER_RPC_URL } : {}),
      account,
    });
    const result = await client.writeContract({
      address: contractAddress as `0x${string}`,
      functionName: "submit_invoice",
      args: [orgId, invoiceId, JSON.stringify(contractPayload)],
      value: 0n,
    });
    txHash = result as string;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `GenLayer transaction failed: ${message}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Record the pending validation in Supabase
  const { data: validationRow, error: valErr } = await supabase
    .from("genlayer_validations")
    .upsert(
      {
        invoice_id: invoiceId,
        org_id: orgId,
        tx_hash: txHash,
        status: "pending",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "invoice_id,org_id" },
    )
    .select("id")
    .single();

  if (valErr || !validationRow) {
    // Transaction sent - log the error but don't fail the response
    console.error("Failed to record genlayer_validation row:", valErr?.message);
  }

  // Update invoice status to submitted_to_genlayer
  await supabase
    .from("invoices")
    .update({ status: "submitted_to_genlayer" })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  // Audit log
  await supabase.from("audit_logs").insert({
    org_id: orgId,
    actor_id: userData.user.id,
    action: "genlayer.submitted",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: {
      tx_hash: txHash,
      contract_address: contractAddress,
      submitter_wallet: wallet.wallet_address,
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      tx_hash: txHash,
      invoice_id: invoiceId,
      status: "pending",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
