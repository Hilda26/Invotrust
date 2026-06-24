import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const VALID_ROLES = ["admin", "finance_reviewer", "viewer"];

interface InvitePayload {
  email?: string;
  role?: string;
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

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = payload.email?.trim().toLowerCase();
  const role = payload.role;

  if (!email || !role || !VALID_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: "A valid email and role are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return new Response(JSON.stringify({ error: "Only owners and admins can invite members" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    return new Response(JSON.stringify({ error: inviteError?.message ?? "Failed to invite user" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    org_id: membership.org_id,
    user_id: invited.user.id,
    role,
  });

  if (memberError) {
    return new Response(JSON.stringify({ error: memberError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("audit_logs").insert({
    org_id: membership.org_id,
    actor_id: userData.user.id,
    action: "member.invited",
    entity_type: "user",
    entity_id: invited.user.id,
    metadata: { email, role },
  });

  return new Response(JSON.stringify({ user_id: invited.user.id, email, role }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
