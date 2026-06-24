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
    const { orgId } = await getOrgContext();
    const supabase = await createClient();

    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "invoice_number, amount, currency, issue_date, due_date, status, preliminary_risk_score, final_risk_score, created_at, vendors(name)"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    const header = row(
      "Invoice Number",
      "Vendor",
      "Amount",
      "Currency",
      "Issue Date",
      "Due Date",
      "Status",
      "Preliminary Risk",
      "Final Risk",
      "Submitted At"
    );

    const lines = (invoices ?? []).map((inv) =>
      row(
        inv.invoice_number,
        inv.vendors?.name,
        inv.amount,
        inv.currency,
        inv.issue_date,
        inv.due_date,
        inv.status,
        inv.preliminary_risk_score,
        inv.final_risk_score,
        new Date(inv.created_at).toISOString()
      )
    );

    const csv = [header, ...lines].join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="invoices-${date}.csv"`,
      },
    });
  } catch {
    return NextResponse.redirect("/login");
  }
}
