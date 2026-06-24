import { AlertTriangle, FileStack, Gauge, ShieldCheck } from "lucide-react";
import { toUSD, formatUSD } from "@/lib/currency";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/shared/link-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import type { AuditLogEntry, InvoiceStatus } from "@/types/domain";
import { DecisionDonut, RiskHistogram, VolumeChart, type DecisionSlice, type RiskBucket, type VolumePoint } from "./charts";

const DECISION_LABELS: Record<InvoiceStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "var(--muted-foreground)" },
  under_review: { label: "Under review", color: "var(--primary)" },
  submitted_to_genlayer: { label: "Validating", color: "var(--genlayer)" },
  approved: { label: "Approved", color: "var(--success)" },
  rejected: { label: "Rejected", color: "var(--destructive)" },
  escalated: { label: "Escalated", color: "var(--warning)" },
};

const RISK_BUCKETS = [
  { band: "0-19", min: 0, max: 19 },
  { band: "20-39", min: 20, max: 39 },
  { band: "40-59", min: 40, max: 59 },
  { band: "60-79", min: 60, max: 79 },
  { band: "80-100", min: 80, max: 100 },
];

function formatActionLabel(action: string) {
  return action.replaceAll(".", " ").replaceAll("_", " ");
}

export default async function DashboardPage() {
  const { orgId, userId } = await getOrgContext();
  const supabase = await createClient();

  const [invoicesRes, auditLogsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, status, preliminary_risk_score, final_risk_score, created_at, vendors(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, actor_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const invoices = invoicesRes.data ?? [];
  const auditLogs = auditLogsRes.data ?? [];

  const riskOf = (inv: (typeof invoices)[number]) => inv.final_risk_score ?? inv.preliminary_risk_score ?? 0;

  const needsAttention = invoices
    .filter((inv) => inv.status === "escalated" || riskOf(inv) >= 70)
    .slice(0, 5);

  const totalAmount = invoices.reduce(
    (sum, inv) => sum + toUSD(Number(inv.amount), inv.currency ?? "USD"),
    0
  );
  const avgRisk = invoices.length > 0 ? invoices.reduce((sum, inv) => sum + riskOf(inv), 0) / invoices.length : 0;
  const highRiskCount = invoices.filter((inv) => riskOf(inv) >= 70).length;

  // Invoice volume over the last 7 days.
  const volumeData: VolumePoint[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dayKey = date.toISOString().slice(0, 10);
    const count = invoices.filter((inv) => inv.created_at.slice(0, 10) === dayKey).length;
    return { day: dayLabel, invoices: count };
  });

  // Decision breakdown by status.
  const statusCounts = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] ?? 0) + 1;
    return acc;
  }, {});
  const decisionData: DecisionSlice[] = Object.entries(statusCounts).map(([status, value]) => ({
    name: DECISION_LABELS[status as InvoiceStatus]?.label ?? status,
    value,
    color: DECISION_LABELS[status as InvoiceStatus]?.color ?? "var(--muted-foreground)",
  }));

  // Risk score distribution.
  const riskHistogramData: RiskBucket[] = RISK_BUCKETS.map(({ band, min, max }) => ({
    band,
    count: invoices.filter((inv) => riskOf(inv) >= min && riskOf(inv) <= max).length,
  }));

  const timelineEntries: AuditLogEntry[] = auditLogs.map((log) => ({
    id: log.id,
    timestamp: log.created_at,
    actor: log.actor_id === userId ? "You" : log.actor_id ? "Team member" : "System",
    action: log.action,
    entityType: log.entity_type,
    entityId: log.entity_id ?? "",
    details: formatActionLabel(log.action),
    onChain: log.action.startsWith("genlayer."),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="An overview of invoice activity, risk, and validation status across your organization."
        actions={<LinkButton href="/app/invoices/upload">Upload invoice</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total invoices" value={invoices.length.toString()} icon={FileStack} />
        <StatCard
          label="Total amount reviewed"
          value={formatUSD(totalAmount)}
          icon={Gauge}
        />
        <StatCard
          label="High-risk invoices"
          value={highRiskCount.toString()}
          icon={AlertTriangle}
          accent="destructive"
          trend={{ value: "Needs review", direction: "flat" }}
        />
        <StatCard label="Avg. risk score" value={avgRisk.toFixed(0)} icon={ShieldCheck} accent="genlayer" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Invoice volume</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volumeData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisionDonut data={decisionData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices currently need attention.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needsAttention.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.vendors?.name ?? "-"}</TableCell>
                      <TableCell>${Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <RiskBadge score={riskOf(inv)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status as InvoiceStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <LinkButton href={`/app/invoices/${inv.id}`} size="sm" variant="outline">
                          Review
                        </LinkButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline entries={timelineEntries} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk score distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskHistogram data={riskHistogramData} />
        </CardContent>
      </Card>
    </div>
  );
}
