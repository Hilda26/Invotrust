"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { createClient } from "@/lib/supabase/client";

interface VendorOption {
  id: string;
  name: string;
  status: string;
}

interface PoOption {
  id: string;
  po_number: string;
  total_amount: number;
  currency: string;
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

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function InvoiceUploadPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [pos, setPos] = useState<PoOption[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [vendorId, setVendorId] = useState<string>("");
  const [poId, setPoId] = useState<string>("");
  const [newVendorName, setNewVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
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
      const [vsResult, poResult] = await Promise.all([
        supabase.from("vendors").select("id, name, status").eq("org_id", mem.org_id).order("name"),
        supabase
          .from("purchase_orders")
          .select("id, po_number, total_amount, currency")
          .eq("org_id", mem.org_id)
          .eq("status", "open")
          .order("created_at", { ascending: false }),
      ]);
      setVendors(vsResult.data ?? []);
      setPos(poResult.data ?? []);
    })();
  }, [supabase]);

  const lineItemsTotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
        0
      ),
    [lineItems]
  );

  const amountMismatch =
    amount !== "" &&
    Math.abs(lineItemsTotal - parseFloat(amount)) > 0.01 &&
    lineItems.some((i) => i.unitPrice);

  function updateRow(id: string, patch: Partial<LineItemRow>) {
    setLineItems((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setLineItems((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please attach an invoice document.");
      return;
    }
    if (!vendorId) {
      setError("Please select a vendor.");
      return;
    }
    if (vendorId === "new" && !newVendorName.trim()) {
      setError("Please enter the new vendor name.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken || !orgId) {
      setError("Session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    // 1. Hash the file
    const fileHash = await sha256Hex(file);

    // 2. Upload file to Storage: invoice-files/{org_id}/{uuid}/{filename}
    const invoiceFileId = crypto.randomUUID();
    const filePath = `${orgId}/${invoiceFileId}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("invoice-files")
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError(`File upload failed: ${uploadError.message}`);
      setSubmitting(false);
      return;
    }

    // 3. Call submit-invoice Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vendor_id: vendorId,
          vendor_name: vendorId === "new" ? newVendorName.trim() : undefined,
          invoice_number: invoiceNumber,
          amount: parseFloat(amount),
          issue_date: issueDate,
          due_date: dueDate,
          file_path: filePath,
          file_hash: fileHash,
          po_id: poId || undefined,
          line_items: lineItems
            .filter((i) => i.description || i.unitPrice)
            .map((i) => ({
              description: i.description,
              quantity: parseFloat(i.quantity) || 1,
              unit_price: parseFloat(i.unitPrice) || 0,
            })),
        }),
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      // Clean up the uploaded file on failure
      await supabase.storage.from("invoice-files").remove([filePath]);
      setError(result.error ?? "Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    const result = await response.json();
    router.push(`/app/invoices/${result.invoice_id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upload invoice"
        description="Attach an invoice document and enter its details. InvoTrust runs deterministic pre-checks immediately and flags high-risk invoices for decentralized validation."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Document</CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropzone onFileSelected={setFile} />
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={vendorId} onValueChange={(value) => setVendorId(value ?? "")}>
                  <SelectTrigger id="vendor" className="w-full">
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                        {v.status === "under_review" ? " (under review)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">+ Add new vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pos.length > 0 && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="po">Purchase order (optional)</Label>
                  <Select value={poId} onValueChange={(v) => setPoId(v === "none" ? "" : (v ?? ""))}>
                    <SelectTrigger id="po" className="w-full">
                      <SelectValue placeholder="No PO - direct invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No PO - direct invoice</SelectItem>
                      {pos.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.po_number} ({po.currency} {Number(po.total_amount).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {vendorId === "new" && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-vendor-name">New vendor name</Label>
                  <Input
                    id="new-vendor-name"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="Acme Supplies Ltd."
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice-number">Invoice number</Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-0001"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-date">Issue date</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="due-date">Due date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
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
              {lineItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_80px_120px_32px] gap-2">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateRow(item.id, { description: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateRow(item.id, { quantity: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Unit price"
                    value={item.unitPrice}
                    onChange={(e) => updateRow(item.id, { unitPrice: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(item.id)}
                    aria-label="Remove line item"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Line items total</span>
                <span className={amountMismatch ? "font-medium text-warning" : "font-medium"}>
                  ${lineItemsTotal.toFixed(2)}
                </span>
              </div>
              {amountMismatch && (
                <p className="text-xs text-warning">
                  Line items total does not match the invoice amount entered above.
                </p>
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? "Submitting..." : "Submit invoice"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
