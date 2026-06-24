import { Webhook } from "npm:standardwebhooks@1.0.0";

interface HookUser {
  email: string;
}

interface HookEmailData {
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_hash_new?: string;
  old_email?: string;
}

interface HookPayload {
  user: HookUser;
  email_data: HookEmailData;
}

const ACTION_COPY: Record<string, { subject: string; heading: string; cta: string; intro: string }> = {
  signup: {
    subject: "Confirm your InvoTrust account",
    heading: "Confirm your email",
    cta: "Confirm email",
    intro: "Click the button below to confirm your email and finish setting up your secure wallet.",
  },
  invite: {
    subject: "You've been invited to InvoTrust",
    heading: "You've been invited",
    cta: "Accept invite",
    intro: "Click the button below to accept your invitation and join your organization on InvoTrust.",
  },
  magiclink: {
    subject: "Your InvoTrust sign-in link",
    heading: "Sign in to InvoTrust",
    cta: "Sign in",
    intro: "Click the button below to sign in.",
  },
  recovery: {
    subject: "Reset your InvoTrust password",
    heading: "Reset your password",
    cta: "Reset password",
    intro: "Click the button below to choose a new password.",
  },
  email_change: {
    subject: "Confirm your new email address",
    heading: "Confirm your new email",
    cta: "Confirm new email",
    intro: "Click the button below to confirm this email change.",
  },
};

function buildLink(data: HookEmailData): string {
  const params = new URLSearchParams({
    token: data.token_hash,
    type: data.email_action_type,
    redirect_to: data.redirect_to,
  });
  return `${data.site_url}/auth/v1/verify?${params.toString()}`;
}

function buildHtml(heading: string, intro: string, cta: string, link: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;color:#111">
  <h2 style="margin:0 0 12px">${heading}</h2>
  <p style="color:#374151;font-size:14px;margin:0 0 24px">${intro}</p>
  <a href="${link}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600">${cta}</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px">If the button doesn't work, copy and paste this link:<br>${link}</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="color:#9ca3af;font-size:12px">InvoTrust - Trust every invoice before you pay.</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!hookSecret) {
    console.error("[send-auth-email] SEND_EMAIL_HOOK_SECRET not set");
    return new Response(JSON.stringify({ error: "Hook not configured" }), { status: 500 });
  }

  let verified: HookPayload;
  try {
    const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
    verified = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    console.error("[send-auth-email] signature verification failed", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const { user, email_data } = verified;

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("[send-auth-email] RESEND_API_KEY not set");
    return new Response(JSON.stringify({ error: "Email provider not configured" }), { status: 500 });
  }

  const copy = ACTION_COPY[email_data.email_action_type] ?? {
    subject: "InvoTrust security notification",
    heading: "InvoTrust",
    cta: "Continue",
    intro: "Click the button below to continue.",
  };

  const link = buildLink(email_data);
  const html = buildHtml(copy.heading, copy.intro, copy.cta, link);
  const fromEmail = Deno.env.get("AUTH_EMAIL_FROM") ?? "InvoTrust <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: user.email,
      subject: copy.subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[send-auth-email] Resend send failed", res.status, body);
    return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
