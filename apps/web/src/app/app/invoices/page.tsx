import { PageHeader } from "@/components/shared/page-header";
import { LinkButton } from "@/components/shared/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge, GenLayerStatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import type { GenLayerStatus, InvoiceStatus } from "@/types/domain";
import { InvoiceFilters } from "./invoice-filters";

const PAGE_SIZE = 50;

const VALID_STATUSES: InvoiceStatus[] = [
  "pending",
  "submitted_to_genlayer",
  "approved",
  "rejected",
  "escalated",
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const params = await searchParams;

  const search = typeof params.q === "string" ? params.q.trim() : "";
  const statusFilter =
    typeof params.status === "string" && VALID_STATUSES.includes(params.status as InvoiceStatus)
      ? (params.status as InvoiceStatus)
      : null;
  const riskFilter = typeof params.risk === "string" ? params.risk : null;
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, issue_date, due_date, status, preliminary_risk_score, final_risk_score, vendors(name), genlayer_validations(status)",
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  if (search) query = query.ilike("invoice_number", `%${search}%`);

  // Risk filter is post-fetch so we must fetch all matching rows then paginate in JS.
  // Only do DB-level pagination when no risk filter is active.
  if (!riskFilter) {
    query = query.range(offset, offset + PAGE_SIZE - 1);
  }

  const { data: invoiceRows, count: rawCount } = await query;
  let invoices = invoiceRows ?? [];

  let total = rawCount ?? 0;

  if (riskFilter === "low") {
    invoices = invoices.filter((inv) => (inv.final_risk_score ?? inv.preliminary_risk_score ?? 0) < 40);
  } else if (riskFilter === "medium") {
    invoices = invoices.filter((inv) => {
      const s = inv.final_risk_score ?? inv.preliminary_risk_score ?? 0;
      return s >= 40 && s < 70;
    });
  } else if (riskFilter === "high") {
    invoices = invoices.filter((inv) => (inv.final_risk_score ?? inv.preliminary_risk_score ?? 0) >= 70);
  }

  // When risk filter is active, paginate the filtered slice in JS
  if (riskFilter) {
    total = invoices.length;
    invoices = invoices.slice(offset, offset + PAGE_SIZE);
  }

  const genLayerStatusOf = (inv: (typeof invoices)[number]): GenLayerStatus => {
    const validation = inv.genlayer_validations?.[0];
    if (!validation) return "not_submitted";
    if (validation.status === "pending") return "pending";
    if (validation.status === "failed") return "failed";
    return "confirmed";
  };

  function buildHref(p: number) {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (statusFilter) qs.set("status", statusFilter);
    if (riskFilter) qs.set("risk", riskFilter);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `/app/invoices${s ? `?${s}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="All invoices submitted for review, with their current risk score and validation status."
        actions={
          <div className="flex gap-2">
            <LinkButton href="/api/export/invoices" variant="outline" size="sm">
              Export CSV
            </LinkButton>
            <LinkButton href="/app/invoices/upload">Upload invoice</LinkButton>
          </div>
        }
      />

      <InvoiceFilters currentSearch={search} currentStatus={statusFilter} currentRisk={riskFilter} />

      <Card>
        <CardContent className="px-0">
          {invoices.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {search || statusFilter || riskFilter
                ? "No invoices match your filters."
                : "No invoices yet. Upload your first invoice to get started."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Issue date</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GenLayer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <a href={`/app/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoice_number}
                        </a>
                      </TableCell>
                      <TableCell>{inv.vendors?.name ?? "-"}</TableCell>
                      <TableCell>
                        {inv.currency} {Number(inv.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{inv.issue_date ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.due_date ?? "-"}</TableCell>
                      <TableCell>
                        <RiskBadge score={inv.final_risk_score ?? inv.preliminary_risk_score ?? 0} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status as InvoiceStatus} />
                      </TableCell>
                      <TableCell>
                        <GenLayerStatusBadge status={genLayerStatusOf(inv)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border px-4 py-3">
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} buildHref={buildHref} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
