"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";

type PoStatus = "open" | "closed" | "cancelled";

export async function setPoStatus(poId: string, status: PoStatus) {
  const { orgId, userId } = await getOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", poId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    actor_id: userId,
    action: "po.status_changed",
    entity_type: "po",
    entity_id: poId,
    metadata: { status },
  });

  revalidatePath(`/app/purchase-orders/${poId}`);
  revalidatePath("/app/purchase-orders");
}
