import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LinkButton } from "@/components/shared/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default async function PurchaseOrdersPage() {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const { data: poRows } = await supabase
    .from("purchase_orders")
    .select("id, po_number, total_amount, currency, status, created_at, vendors(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const pos = poRows ?? [];

  // Count invoices matched per PO
  const poIds = pos.map((p) => p.id);
  const { data: invoiceCounts } = poIds.length
    ? await supabase
        .from("invoices")
        .select("po_id")
        .in("po_id", poIds)
        .eq("org_id", orgId)
    : { data: [] };

  const countByPo: Record<string, number> = {};
  for (const row of invoiceCounts ?? []) {
    if (row.po_id) countByPo[row.po_id] = (countByPo[row.po_id] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase Orders"
        description="Track POs and match them against submitted invoices."
        actions={<LinkButton href="/app/purchase-orders/new">New PO</LinkButton>}
      />

      <Card>
        <CardContent className="px-0">
          {pos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No purchase orders yet. Create your first PO to start matching invoices.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Total amount</TableHead>
                  <TableHead className="text-right">Invoices matched</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">
                      <Link href={`/app/purchase-orders/${po.id}`} className="hover:underline">
                        {po.po_number}
                      </Link>
                    </TableCell>
                    <TableCell>{po.vendors?.name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {po.currency} {Number(po.total_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {countByPo[po.id] ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(STATUS_STYLES[po.status])}>
                        {STATUS_LABEL[po.status] ?? po.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
