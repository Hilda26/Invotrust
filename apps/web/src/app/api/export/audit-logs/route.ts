import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";

function escapeCsv(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

export async function GET() {
  try {
    const { orgId, userId } = await getOrgContext();
    const supabase = await createClient();

    const { data: logs } = await supabase
      .from("audit_logs")
      .select("action, entity_type, entity_id, actor_id, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    const header = row("Timestamp", "Actor", "Action", "Entity Type", "Entity ID");

    const lines = (logs ?? []).map((entry) => {
      const actor = entry.actor_id === userId ? "You" : entry.actor_id ? "Team member" : "System";
      return row(
        new Date(entry.created_at).toISOString(),
        actor,
        entry.action,
        entry.entity_type,
        entry.entity_id
      );
    });

    const csv = [header, ...lines].join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs-${date}.csv"`,
      },
    });
  } catch {
    return NextResponse.redirect("/login");
  }
}
