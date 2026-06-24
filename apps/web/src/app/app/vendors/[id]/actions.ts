"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";

type VendorStatus = "active" | "under_review" | "blocked";

async function callBlockVendorContract(vendorId: string, action: "block" | "unblock", reason?: string) {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/block-vendor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ vendor_id: vendorId, action, reason }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? `Failed to ${action} vendor on GenLayer`);
  }
}

export async function setVendorStatus(
  vendorId: string,
  currentStatus: VendorStatus,
  newStatus: VendorStatus,
  reason?: string,
) {
  const { orgId, userId } = await getOrgContext();
  const supabase = await createClient();

  // Only touch the on-chain blocklist when actually entering or leaving the
  // "blocked" state - InvoiceValidator's blocklist is the deterministic
  // fast path that auto-rejects future submissions from this vendor
  // without AI review. Other transitions (active <-> under_review) are
  // off-chain only.
  if (newStatus === "blocked" && currentStatus !== "blocked") {
    await callBlockVendorContract(vendorId, "block", reason || "Blocked via InvoTrust vendor management");
  } else if (currentStatus === "blocked" && newStatus !== "blocked") {
    await callBlockVendorContract(vendorId, "unblock");
  }

  const { error } = await supabase
    .from("vendors")
    .update({ status: newStatus })
    .eq("id", vendorId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    actor_id: userId,
    action: "vendor.status_changed",
    entity_type: "vendor",
    entity_id: vendorId,
    metadata: { status: newStatus, reason: newStatus === "blocked" ? reason : undefined },
  });

  revalidatePath(`/app/vendors/${vendorId}`);
  revalidatePath("/app/vendors");
}
