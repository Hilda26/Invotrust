import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { MembersTable, type Member } from "./members-table";

export default async function MembersSettingsPage() {
  const { orgId, role, userId } = await getOrgContext();
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_organization_members", { p_org_id: orgId });
  const members = (data ?? []) as Member[];

  const canManage = role === "owner" || role === "admin";

  return <MembersTable members={members} orgId={orgId} currentUserId={userId} canManage={canManage} />;
}
