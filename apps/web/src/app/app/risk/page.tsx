import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskGauge } from "@/components/shared/risk-gauge";
import { StatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { riskBand, type AnomalyFlag, type InvoiceStatus } from "@/types/domain";

export default async function RiskAnalysisPage() {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, status, preliminary_risk_score, final_risk_score, created_at, vendors(name), invoice_analysis(anomaly_flags)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const invoices = invoiceRows ?? [];
  const riskOf = (inv: (typeof invoices)[number]) => inv.final_risk_score ?? inv.preliminary_risk_score ?? 0;

  const bands = { low: 0, medium: 0, high: 0 } as Record<string, number>;
  const flagTypeCounts: Record<string, number> = {};

  for (const inv of invoices) {
    bands[riskBand(riskOf(inv))] += 1;
    const flags = Array.isArray(inv.invoice_analysis?.anomaly_flags)
      ? (inv.invoice_analysis!.anomaly_flags as unknown as AnomalyFlag[])
      : [];
    for (const flag of flags) {
      flagTypeCounts[flag.type] = (flagTypeCounts[flag.type] ?? 0) + 1;
    }
  }

  const topFlags = Object.entries(flagTypeCounts).sort((a, b) => b[1] - a[1]);

  const sortedInvoices = [...invoices].sort((a, b) => riskOf(b) - riskOf(a));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Risk Analysis"
        description="Portfolio-level view of invoice risk scores and the most common anomaly types this period."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <RiskGauge score={15} size={64} showLabel={false} />
            <div>
              <p className="text-sm text-muted-foreground">Low risk</p>
              <p className="text-2xl font-semibold">{bands.low}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <RiskGauge score={55} size={64} showLabel={false} />
            <div>
              <p className="text-sm text-muted-foreground">Medium risk</p>
              <p className="text-2xl font-semibold">{bands.medium}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <RiskGauge score={90} size={64} showLabel={false} />
            <div>
              <p className="text-sm text-muted-foreground">High risk</p>
              <p className="text-2xl font-semibold">{bands.high}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Invoices by risk score</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {sortedInvoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No invoices to analyze yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Risk score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <Link href={`/app/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.vendors?.name ?? "-"}</TableCell>
                      <TableCell>
                        {inv.currency} {Number(inv.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <RiskGauge score={riskOf(inv)} size={40} showLabel={false} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status as InvoiceStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top anomaly types</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {topFlags.length === 0 && <p className="text-sm text-muted-foreground">No anomalies detected.</p>}
            {topFlags.map(([type, count]) => (
              <div key={type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize">{type.replaceAll("_", " ")}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{ width: `${(count / invoices.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
