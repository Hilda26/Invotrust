import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { cn } from "@/lib/utils";
import { VendorFilters } from "./vendor-filters";

const PAGE_SIZE = 50;

const VALID_STATUSES = ["active", "under_review", "blocked"] as const;
type VendorStatus = (typeof VALID_STATUSES)[number];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  under_review: "bg-warning/10 text-warning border-warning/20",
  blocked: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  under_review: "Under Review",
  blocked: "Blocked",
};

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const params = await searchParams;

  const search = typeof params.q === "string" ? params.q.trim() : "";
  const statusFilter =
    typeof params.status === "string" && (VALID_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as VendorStatus)
      : null;
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("vendors")
    .select(
      "id, name, tax_id, status, vendor_reputation(reputation_score, total_invoices, flagged_invoices, avg_price_variance_pct)",
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("name")
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) query = query.ilike("name", `%${search}%`);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: vendors, count } = await query;
  const total = count ?? 0;

  function buildHref(p: number) {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (statusFilter) qs.set("status", statusFilter);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `/app/vendors${s ? `?${s}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vendors"
        description="Reputation scores and invoice history for every vendor in your organization."
      />

      <VendorFilters currentSearch={search} currentStatus={statusFilter} />

      <Card>
        <CardContent className="px-0">
          {!vendors || vendors.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {search || statusFilter
                ? "No vendors match your filters."
                : "No vendors yet. Vendors are added automatically when you upload your first invoice."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Tax ID</TableHead>
                    <TableHead>Reputation</TableHead>
                    <TableHead className="text-right">Total invoices</TableHead>
                    <TableHead className="text-right">Flagged</TableHead>
                    <TableHead className="text-right">Avg. price variance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => {
                    const reputation = vendor.vendor_reputation;
                    const reputationScore = reputation?.reputation_score ?? 50;
                    return (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">
                          <Link href={`/app/vendors/${vendor.id}`} className="hover:underline">
                            {vendor.name}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{vendor.tax_id ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  reputationScore >= 70
                                    ? "bg-success"
                                    : reputationScore >= 40
                                      ? "bg-warning"
                                      : "bg-destructive"
                                )}
                                style={{ width: `${reputationScore}%` }}
                              />
                            </div>
                            <span className="text-sm tabular-nums">{reputationScore}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{reputation?.total_invoices ?? 0}</TableCell>
                        <TableCell className="text-right">{reputation?.flagged_invoices ?? 0}</TableCell>
                        <TableCell className="text-right">{(reputation?.avg_price_variance_pct ?? 0).toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLES[vendor.status]}>
                            {STATUS_LABEL[vendor.status] ?? vendor.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
