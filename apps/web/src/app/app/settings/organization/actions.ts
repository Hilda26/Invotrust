"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";

export async function updateOrganizationName(formData: FormData) {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("organizations").update({ name }).eq("id", orgId);
  revalidatePath("/app/settings/organization");
}

export async function updateRiskThreshold(formData: FormData) {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const riskThreshold = Number(formData.get("risk_threshold"));
  if (!Number.isFinite(riskThreshold)) return;

  await supabase.from("organizations").update({ risk_threshold: riskThreshold }).eq("id", orgId);
  revalidatePath("/app/settings/organization");
}

export async function updateProcurementPolicy(formData: FormData) {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const procurementPolicy = String(formData.get("procurement_policy") ?? "");

  await supabase.from("organizations").update({ procurement_policy: procurementPolicy }).eq("id", orgId);
  revalidatePath("/app/settings/organization");
}
