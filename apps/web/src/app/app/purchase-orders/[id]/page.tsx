import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import type { InvoiceStatus } from "@/types/domain";
import { PoStatusButton } from "./po-status-button";
import { cn } from "@/lib/utils";

const PO_STATUS_STYLES: Record<string, string> = {
  open: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const PO_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_number, total_amount, currency, status, created_at, vendors(id, name), po_line_items(id, description, quantity, unit_price)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (!po) notFound();

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, issue_date, status, preliminary_risk_score, final_risk_score")
    .eq("org_id", orgId)
    .eq("po_id", id)
    .order("issue_date", { ascending: false });

  const invoices = invoiceRows ?? [];
  const lineItems = po.po_line_items ?? [];
  const vendor = po.vendors as { id: string; name: string } | null;

  const lineTotal = lineItems.reduce(
    (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
    0,
  );

  const invoicedTotal = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const remaining = Number(po.total_amount) - invoicedTotal;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={po.po_number}
        description={`${vendor?.name ?? "Unknown vendor"} · ${po.currency} ${Number(po.total_amount).toLocaleString()}`}
        actions={
          <>
            <Badge variant="outline" className={cn(PO_STATUS_STYLES[po.status])}>
              {PO_STATUS_LABEL[po.status] ?? po.status}
            </Badge>
            <PoStatusButton poId={id} currentStatus={po.status} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">PO value</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {po.currency} {Number(po.total_amount).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">Invoiced so far</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {po.currency} {invoicedTotal.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 py-4">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", remaining < 0 ? "text-destructive" : "")}>
              {po.currency} {remaining.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {lineItems.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No line items on this PO.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell>{li.description ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{li.quantity ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {li.unit_price != null ? `$${Number(li.unit_price).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {li.quantity != null && li.unit_price != null
                          ? `$${(Number(li.quantity) * Number(li.unit_price)).toLocaleString()}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-sm font-medium">
                      Line items total
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${lineTotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matched invoices</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {invoices.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                No invoices matched to this PO yet. Select this PO when uploading an invoice.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                      <TableCell className="text-right tabular-nums">
                        {inv.currency} {Number(inv.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <RiskBadge score={inv.final_risk_score ?? inv.preliminary_risk_score ?? 0} />
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
      </div>

      <div className="text-xs text-muted-foreground">
        Vendor:{" "}
        {vendor ? (
          <Link href={`/app/vendors/${vendor.id}`} className="hover:underline">
            {vendor.name}
          </Link>
        ) : (
          "-"
        )}{" "}
        · Created {new Date(po.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
