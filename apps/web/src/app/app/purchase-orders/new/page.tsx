"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface VendorOption {
  id: string;
  name: string;
}

interface LineItemRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function newRow(): LineItemRow {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" };
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([newRow()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members")
        .select("org_id")
        .limit(1)
        .maybeSingle();
      if (!mem) return;
      setOrgId(mem.org_id);
      const { data: vs } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("org_id", mem.org_id)
        .eq("status", "active")
        .order("name");
      setVendors(vs ?? []);
    })();
  }, [supabase]);

  const lineTotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, li) => sum + (parseFloat(li.quantity) || 0) * (parseFloat(li.unitPrice) || 0),
        0,
      ),
    [lineItems],
  );

  function updateRow(id: string, patch: Partial<LineItemRow>) {
    setLineItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setLineItems((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) { setError("Please select a vendor."); return; }
    if (!poNumber.trim()) { setError("Please enter a PO number."); return; }
    if (lineTotal <= 0) { setError("Add at least one line item with a price."); return; }
    if (!orgId) { setError("Session error - please refresh."); return; }

    setSubmitting(true);
    setError(null);

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        org_id: orgId,
        vendor_id: vendorId,
        po_number: poNumber.trim(),
        total_amount: lineTotal,
        currency,
        status: "open",
      })
      .select("id")
      .single();

    if (poErr || !po) {
      setError(poErr?.message ?? "Failed to create purchase order.");
      setSubmitting(false);
      return;
    }

    const validItems = lineItems.filter((li) => li.description || li.unitPrice);
    if (validItems.length > 0) {
      await supabase.from("po_line_items").insert(
        validItems.map((li) => ({
          po_id: po.id,
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unit_price: parseFloat(li.unitPrice) || 0,
        })),
      );
    }

    router.push(`/app/purchase-orders/${po.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Purchase Order"
        description="Create a PO to pre-authorise spend with a vendor. Invoices can be matched against it on upload."
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => setVendorId(v ?? "")}>
                <SelectTrigger id="vendor" className="w-full">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-number">PO number</Label>
              <Input
                id="po-number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-2026-001"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? "USD")}>
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLineItems((rows) => [...rows, newRow()])}
            >
              <Plus /> Add line item
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lineItems.map((li) => (
              <div key={li.id} className="grid grid-cols-[1fr_80px_120px_32px] gap-2">
                <Input
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => updateRow(li.id, { description: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={li.quantity}
                  onChange={(e) => updateRow(li.id, { quantity: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Unit price"
                  value={li.unitPrice}
                  onChange={(e) => updateRow(li.id, { unitPrice: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(li.id)}
                  aria-label="Remove line item"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">PO total</span>
              <span className="font-semibold tabular-nums">
                {currency} {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !vendorId}>
            {submitting ? "Creating..." : "Create PO"}
          </Button>
        </div>
      </form>
    </div>
  );
}
