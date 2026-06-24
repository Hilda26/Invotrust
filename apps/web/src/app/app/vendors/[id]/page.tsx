import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import type { InvoiceStatus } from "@/types/domain";
import { VendorStatusButton } from "./vendor-status-button";

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

export default async function VendorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, tax_id, email, status, vendor_reputation(reputation_score, total_invoices, flagged_invoices, avg_price_variance_pct)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (!vendor) {
    notFound();
  }

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, issue_date, status, preliminary_risk_score, final_risk_score, invoice_analysis(anomaly_flags)")
    .eq("org_id", orgId)
    .eq("vendor_id", id)
    .order("issue_date", { ascending: false });

  const invoices = invoiceRows ?? [];
  const riskOf = (inv: (typeof invoices)[number]) => inv.final_risk_score ?? inv.preliminary_risk_score ?? 0;

  const flagged = invoices.filter((inv) => {
    const flags = inv.invoice_analysis?.anomaly_flags;
    return Array.isArray(flags) && flags.length > 0;
  });

  const reputation = vendor.vendor_reputation;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={vendor.name}
        description={`Tax ID ${vendor.tax_id ?? "-"} · ${vendor.email ?? "no email on file"}`}
        actions={
          <>
            <Badge variant="outline" className={STATUS_STYLES[vendor.status]}>
              {STATUS_LABEL[vendor.status] ?? vendor.status}
            </Badge>
            <VendorStatusButton vendorId={id} currentStatus={vendor.status as "active" | "under_review" | "blocked"} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">Reputation score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{reputation?.reputation_score ?? 50} / 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">Total invoices</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{reputation?.total_invoices ?? invoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">Flagged invoices</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{reputation?.flagged_invoices ?? flagged.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">Avg. price variance</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{(reputation?.avg_price_variance_pct ?? 0).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="flags">Flags &amp; History</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="px-0">
              {invoices.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No invoices from this vendor yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Issue date</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          <Link href={`/app/invoices/${inv.id}`} className="hover:underline">
                            {inv.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {inv.currency} {Number(inv.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inv.issue_date ?? "-"}</TableCell>
                        <TableCell>
                          <RiskBadge score={riskOf(inv)} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={inv.status as InvoiceStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flagged invoices</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {flagged.length === 0 && <p className="text-sm text-muted-foreground">No flagged invoices.</p>}
              {flagged.map((inv) => {
                const flags = Array.isArray(inv.invoice_analysis?.anomaly_flags)
                  ? (inv.invoice_analysis!.anomaly_flags as { detail: string }[])
                  : [];
                return (
                  <div key={inv.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/invoices/${inv.id}`} className="text-sm font-medium hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <RiskBadge score={riskOf(inv)} />
                    </div>
                    <ul className="mt-2 flex flex-col gap-1">
                      {flags.map((flag, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {flag.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
