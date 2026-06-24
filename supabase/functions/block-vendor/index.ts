// block-vendor Edge Function
// Calls InvoiceValidator.block_vendor or unblock_vendor on GenLayer
// StudioNet, signed by the calling admin/owner's own wallet. Future
// invoice submissions from a blocked vendor are deterministically
// rejected on-chain without any AI review (see submit_invoice's
// fast-path check in InvoiceValidator.py).
//
// Mirrors the auth/wallet-signing pattern already established in
// submit-to-genlayer.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { createClient as createGenLayerClient, createAccount, chains } from "npm:genlayer-js@1.1.8";
import { decryptPrivateKey, type EncryptedPrivateKey } from "../_shared/encryption.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

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
      JSON.stringify({ error: "GENLAYER_CONTRACT_ADDRESS is not configured." }),
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

  let vendorId: string;
  let reason: string;
  let action: "block" | "unblock";
  try {
    const body = await req.json() as { vendor_id: string; reason?: string; action?: string };
    vendorId = body.vendor_id;
    action = body.action === "unblock" ? "unblock" : "block";
    reason = body.reason ?? "";
    if (!vendorId) throw new Error("missing vendor_id");
    if (action === "block" && !reason) throw new Error("reason is required to block a vendor");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [memberResult, vendorResult, walletResult] = await Promise.all([
    supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle(),
    supabase.from("vendors").select("id, org_id").eq("id", vendorId).maybeSingle(),
    supabase
      .from("user_wallets")
      .select("wallet_address, encrypted_private_key")
      .eq("user_id", userData.user.id)
      .maybeSingle(),
  ]);

  if (!memberResult.data || !["admin", "owner"].includes(memberResult.data.role)) {
    return new Response(JSON.stringify({ error: "Only owners and admins can block or unblock vendors" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = memberResult.data.org_id;

  if (!vendorResult.data || vendorResult.data.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "Vendor not found in your organization" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!walletResult.data) {
    return new Response(
      JSON.stringify({ error: "No wallet found for your account. Check Settings > Wallet." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let privateKeyHex: string;
  try {
    const encryptedPayload: EncryptedPrivateKey = JSON.parse(walletResult.data.encrypted_private_key);
    const privateKeyBytes = await decryptPrivateKey(encryptedPayload);
    privateKeyHex = `0x${toHex(privateKeyBytes)}`;
  } catch {
    return new Response(JSON.stringify({ error: "Failed to decrypt wallet private key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
      functionName: action === "block" ? "block_vendor" : "unblock_vendor",
      args: action === "block" ? [orgId, vendorId, reason] : [orgId, vendorId],
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

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    actor_id: userData.user.id,
    action: action === "block" ? "vendor.blocked" : "vendor.unblocked",
    entity_type: "vendor",
    entity_id: vendorId,
    metadata: { reason, tx_hash: txHash, contract_address: contractAddress },
  });

  return new Response(
    JSON.stringify({ success: true, tx_hash: txHash, vendor_id: vendorId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
