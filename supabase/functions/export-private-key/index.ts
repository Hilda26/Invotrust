import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { decryptPrivateKey, type EncryptedPrivateKey } from "../_shared/encryption.ts";
import { restrictedCorsHeaders, handleRestrictedCorsPreflight } from "../_shared/cors.ts";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const preflight = handleRestrictedCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: restrictedCorsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...restrictedCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...restrictedCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: wallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("wallet_address, encrypted_private_key")
    .eq("user_id", userData.user.id)
    .single();

  if (walletError || !wallet) {
    return new Response(JSON.stringify({ error: "Wallet not found" }), {
      status: 404,
      headers: { ...restrictedCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const encryptedPayload = JSON.parse(wallet.encrypted_private_key) as EncryptedPrivateKey;
  const privateKey = await decryptPrivateKey(encryptedPayload);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    await supabase.from("audit_logs").insert({
      org_id: membership.org_id,
      actor_id: userData.user.id,
      action: "wallet.key_exported",
      entity_type: "wallet",
      entity_id: userData.user.id,
    });
  }

  return new Response(
    JSON.stringify({
      wallet_address: wallet.wallet_address,
      private_key: `0x${toHex(privateKey)}`,
    }),
    { status: 200, headers: { ...restrictedCorsHeaders, "Content-Type": "application/json" } },
  );
});
