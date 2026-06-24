import { redirect } from "next/navigation";
import { createClient } from "./server";

export interface OrgContext {
  userId: string;
  orgId: string;
  role: string;
}

/**
 * Resolves the current user's organization membership. Users in this app
 * belong to exactly one organization (created during onboarding), so the
 * first membership row is authoritative. Redirects to onboarding if the
 * user has no organization yet.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  return {
    userId: userData.user.id,
    orgId: membership.org_id,
    role: membership.role,
  };
}
