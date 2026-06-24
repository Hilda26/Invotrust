"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setVendorStatus } from "./actions";

type VendorStatus = "active" | "under_review" | "blocked";

interface Props {
  vendorId: string;
  currentStatus: VendorStatus;
}

export function VendorStatusButton({ vendorId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function changeStatus(newStatus: VendorStatus, blockReason?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await setVendorStatus(vendorId, currentStatus, newStatus, blockReason);
        setBlockOpen(false);
        setReason("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update vendor status.");
      }
    });
  }

  if (currentStatus === "blocked") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button variant="outline" disabled={isPending} onClick={() => changeStatus("active")}>
          {isPending ? "Updating..." : "Unblock vendor"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (currentStatus === "under_review") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex gap-2">
          <Button variant="outline" disabled={isPending} onClick={() => changeStatus("active")}>
            {isPending ? "Updating..." : "Mark active"}
          </Button>
          <BlockVendorDialog
            open={blockOpen}
            onOpenChange={setBlockOpen}
            reason={reason}
            onReasonChange={setReason}
            isPending={isPending}
            onConfirm={() => changeStatus("blocked", reason)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // active
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button variant="outline" disabled={isPending} onClick={() => changeStatus("under_review")}>
          {isPending ? "Updating..." : "Mark under review"}
        </Button>
        <BlockVendorDialog
          open={blockOpen}
          onOpenChange={setBlockOpen}
          reason={reason}
          onReasonChange={setReason}
          isPending={isPending}
          onConfirm={() => changeStatus("blocked", reason)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function BlockVendorDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="destructive" />}>Block vendor</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block this vendor</DialogTitle>
          <DialogDescription>
            This adds the vendor to the organization&apos;s on-chain blocklist.
            Future invoice submissions from this vendor are rejected
            automatically, without AI review.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="block-reason">Reason</Label>
          <Input
            id="block-reason"
            placeholder="e.g. Confirmed fraudulent vendor"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={!reason.trim() || isPending} onClick={onConfirm}>
            {isPending ? "Blocking..." : "Block vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
