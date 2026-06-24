import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { encryptPrivateKey } from "../_shared/encryption.ts";
import { generateWallet } from "../_shared/wallet.ts";

interface AuthUserWebhookPayload {
  type: string;
  table: string;
  schema: string;
  record?: { id?: string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: AuthUserWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const userId = payload.record?.id;
  if (!userId) {
    return new Response("Missing record.id", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotent: if a wallet already exists for this user, return it as-is.
  const { data: existing } = await supabase
    .from("user_wallets")
    .select("wallet_address")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ wallet_address: existing.wallet_address }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const wallet = generateWallet();
  const encryptedPrivateKey = await encryptPrivateKey(wallet.privateKey);

  const { error } = await supabase.from("user_wallets").insert({
    user_id: userId,
    wallet_address: wallet.address,
    encrypted_private_key: JSON.stringify(encryptedPrivateKey),
    key_encryption_version: encryptedPrivateKey.v,
  });

  if (error) {
    console.error("Failed to store generated wallet", error);
    return new Response(JSON.stringify({ error: "Failed to store wallet" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ wallet_address: wallet.address }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
