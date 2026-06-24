"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { redirect } from "next/navigation";

type Decision = "approved" | "rejected" | "escalated";

async function recordDecision(invoiceId: string, decision: Decision) {
  const { orgId, userId } = await getOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status: decision })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    actor_id: userId,
    action: `invoice.${decision}`,
    entity_type: "invoice",
    entity_id: invoiceId,
  });

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath("/app/invoices");
  revalidatePath("/app/dashboard");
}

export async function approveInvoice(invoiceId: string) {
  await recordDecision(invoiceId, "approved");
}

export async function rejectInvoice(invoiceId: string) {
  await recordDecision(invoiceId, "rejected");
}

export async function escalateInvoice(invoiceId: string) {
  await recordDecision(invoiceId, "escalated");
}

export async function submitToGenLayer(invoiceId: string) {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) redirect("/login");

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-to-genlayer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    },
  );

  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? "Failed to submit to GenLayer");
  }

  revalidatePath(`/app/invoices/${invoiceId}`);
}
