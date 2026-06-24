import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, FileText, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskGauge } from "@/components/shared/risk-gauge";
import { StatusBadge, GenLayerStatusBadge } from "@/components/shared/status-badge";
import { AnomalyFlagList } from "@/components/shared/anomaly-flag-list";
import { ExplainabilityPanel } from "@/components/shared/explainability-panel";
import { Timeline } from "@/components/shared/timeline";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { approveInvoice, rejectInvoice, escalateInvoice, submitToGenLayer } from "./actions";
import type { AnomalyFlag, AuditLogEntry, GenLayerStatus, InvoiceStatus, RiskFactor } from "@/types/domain";

export default async function InvoiceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, userId } = await getOrgContext();
  const supabase = await createClient();

  const genLayerContractConfigured = !!process.env.GENLAYER_CONTRACT_ADDRESS;

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, issue_date, due_date, status, preliminary_risk_score, final_risk_score, vendor_id, file_path, vendors(name), invoice_line_items(id, description, quantity, unit_price, total), invoice_analysis(anomaly_flags), genlayer_validations(status, tx_hash, risk_factors, reasoning)",
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  const { data: auditRows } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, actor_id")
    .eq("org_id", orgId)
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const history: AuditLogEntry[] = (auditRows ?? []).map((log) => ({
    id: log.id,
    timestamp: log.created_at,
    actor: log.actor_id === userId ? "You" : log.actor_id ? "Team member" : "System",
    action: log.action,
    entityType: log.entity_type,
    entityId: log.entity_id ?? "",
    details: log.action.replaceAll(".", " ").replaceAll("_", " "),
    onChain: log.action.startsWith("genlayer."),
  }));

  // Generate a 1-hour signed URL for the invoice file (null if no file stored)
  const { data: signedUrlData } = invoice.file_path
    ? await supabase.storage.from("invoice-files").createSignedUrl(invoice.file_path, 3600)
    : { data: null };
  const fileUrl = signedUrlData?.signedUrl ?? null;
  const fileName = invoice.file_path?.split("/").pop() ?? `${invoice.invoice_number}.pdf`;
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  const score = invoice.final_risk_score ?? invoice.preliminary_risk_score ?? 0;

  const anomalyFlags: AnomalyFlag[] = Array.isArray(invoice.invoice_analysis?.anomaly_flags)
    ? (invoice.invoice_analysis!.anomaly_flags as unknown as AnomalyFlag[])
    : [];

  const validation = invoice.genlayer_validations?.[0];
  const genLayerStatus: GenLayerStatus = !validation
    ? "not_submitted"
    : validation.status === "pending"
      ? "pending"
      : validation.status === "failed"
        ? "failed"
        : "confirmed";

  const riskFactors: RiskFactor[] | undefined = Array.isArray(validation?.risk_factors)
    ? (validation!.risk_factors as unknown as RiskFactor[])
    : undefined;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHeader
        title={invoice.invoice_number}
        description={`${invoice.vendors?.name ?? "Unknown vendor"} · ${invoice.currency} ${Number(invoice.amount).toLocaleString()} · Issued ${invoice.issue_date ?? "-"}`}
        actions={
          <>
            <StatusBadge status={invoice.status as InvoiceStatus} className="text-sm" />
            <GenLayerStatusBadge status={genLayerStatus} className="text-sm" />
          </>
        }
      />

      {genLayerStatus === "pending" && (
        <div className="flex items-start gap-2 rounded-md border border-genlayer/20 bg-genlayer/5 px-4 py-3 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0 text-genlayer" />
          <p>
            This invoice is being validated by GenLayer&apos;s decentralized
            validator network. Reaching consensus can take anywhere from a
            few minutes to about an hour depending on network conditions -
            this page will update automatically once a decision is reached.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Document</CardTitle>
          </CardHeader>
          <CardContent>
            {fileUrl && isPdf ? (
              <iframe
                src={fileUrl}
                title={fileName}
                className="aspect-3/4 w-full rounded-md border border-border"
              />
            ) : fileUrl ? (
              <img
                src={fileUrl}
                alt={fileName}
                className="aspect-3/4 w-full rounded-md border border-border object-contain bg-muted"
              />
            ) : (
              <div className="flex aspect-3/4 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted text-muted-foreground">
                <FileText className="size-10" />
                <p className="text-sm">{fileName}</p>
              </div>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                <Download className="size-3.5" />
                Download {fileName}
              </a>
            )}
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd>
                  <Link href={`/app/vendors/${invoice.vendor_id}`} className="font-medium hover:underline">
                    {invoice.vendors?.name ?? "Unknown vendor"}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium">
                  {invoice.currency} {Number(invoice.amount).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Issue date</dt>
                <dd className="font-medium">{invoice.issue_date ?? "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Due date</dt>
                <dd className="font-medium">{invoice.due_date ?? "-"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="explainability">Explainability</TabsTrigger>
              <TabsTrigger value="line-items">Line Items</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex flex-col gap-4">
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:justify-around">
                  <RiskGauge score={score} size={120} />
                  <div className="flex flex-col gap-2 text-sm">
                    <p>
                      <span className="font-medium">Preliminary score:</span>{" "}
                      {invoice.preliminary_risk_score ?? "-"} / 100
                    </p>
                    {invoice.final_risk_score !== null && (
                      <p>
                        <span className="font-medium">GenLayer consensus score:</span> {invoice.final_risk_score} / 100
                      </p>
                    )}
                    {validation?.tx_hash && <p className="font-mono text-xs text-muted-foreground">tx: {validation.tx_hash}</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anomaly flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <AnomalyFlagList flags={anomalyFlags} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="explainability">
              <ExplainabilityPanel reasoning={validation?.reasoning ?? undefined} riskFactors={riskFactors} />
            </TabsContent>

            <TabsContent value="line-items">
              <Card>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(invoice.invoice_line_items ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${Number(item.unit_price ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">${Number(item.total ?? 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardContent className="pt-6">
                  <Timeline entries={history} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-6 py-3 backdrop-blur supports-backdrop-filter:bg-background/60 sm:left-(--sidebar-width) group-data-[state=collapsed]/sidebar-wrapper:sm:left-(--sidebar-width-icon)">
        <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {invoice.status === "approved" || invoice.status === "rejected"
              ? `Invoice ${invoice.status}.`
              : "Make a decision or submit for decentralized validation."}
          </p>
          <div className="flex items-center gap-2">
            {invoice.status !== "approved" && invoice.status !== "rejected" && (
              <>
                {genLayerContractConfigured ? (
                  <form action={submitToGenLayer.bind(null, id)}>
                    <Button type="submit" variant="outline">
                      Submit to GenLayer
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    title="Deploy the InvoiceValidator contract to GenLayer StudioNet first."
                  >
                    Submit to GenLayer
                  </Button>
                )}
                <form action={rejectInvoice.bind(null, id)}>
                  <Button type="submit" variant="destructive">Reject</Button>
                </form>
                <form action={escalateInvoice.bind(null, id)}>
                  <Button
                    type="submit"
                    className="bg-warning/10 text-warning hover:bg-warning/20"
                    variant="outline"
                  >
                    Escalate
                  </Button>
                </form>
                <form action={approveInvoice.bind(null, id)}>
                  <Button
                    type="submit"
                    className="bg-success/10 text-success hover:bg-success/20"
                    variant="outline"
                  >
                    Approve
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
