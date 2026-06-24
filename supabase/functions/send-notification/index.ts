import { createClient } from "npm:@supabase/supabase-js@2.49.4";

interface NotifyPayload {
  event: string;
  org_id: string;
  invoice_id?: string;
  details?: Record<string, unknown>;
}

const EVENT_SUBJECTS: Record<string, string> = {
  "invoice.submitted": "New invoice submitted for review",
  "genlayer.consensus_received": "GenLayer validation complete",
  "invoice.escalated": "Invoice escalated - action required",
  "invoice.approved": "Invoice approved",
  "invoice.rejected": "Invoice rejected",
};

function buildHtml(event: string, details: Record<string, unknown>): string {
  const title = EVENT_SUBJECTS[event] ?? event;

  const rows = Object.entries(details)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px">${k.replace(/_/g, " ")}</td><td style="padding:4px 0;font-size:13px">${v}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;color:#111">
  <h2 style="margin:0 0 8px">${title}</h2>
  <p style="color:#6b7280;margin:0 0 20px;font-size:14px">InvoTrust notification</p>
  <table style="width:100%;border-collapse:collapse">
    ${rows}
  </table>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="color:#9ca3af;font-size:12px">This is an automated notification from InvoTrust. Log in to take action.</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Not configured - log and return success so callers don't fail
    console.log("[send-notification] RESEND_API_KEY not set, skipping email");
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { event, org_id, details = {} } = payload;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Fetch owner/admin emails for this org
  const { data: members } = await supabase.rpc("get_organization_members", { p_org_id: org_id });
  const recipients: string[] = (members ?? [])
    .filter((m: { role: string; email: string }) => ["owner", "admin"].includes(m.role) && m.email)
    .map((m: { email: string }) => m.email);

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: "no recipients" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subject = EVENT_SUBJECTS[event] ?? `InvoTrust: ${event}`;
  const html = buildHtml(event, details);

  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "notifications@invotrust.app";

  const results = await Promise.allSettled(
    recipients.map((to) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: fromEmail, to, subject, html }),
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return new Response(JSON.stringify({ sent, failed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
