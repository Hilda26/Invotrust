import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { NavSidebar } from "@/components/shared/nav-sidebar";
import { TopBar } from "@/components/shared/top-bar";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const [{ data: org }, { data: userData }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    supabase.auth.getUser(),
  ]);

  return (
    <SidebarProvider>
      <NavSidebar />
      <SidebarInset>
        <TopBar orgName={org?.name ?? "Organization"} userEmail={userData.user?.email ?? ""} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
