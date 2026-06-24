"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setPoStatus } from "./actions";

interface Props {
  poId: string;
  currentStatus: string;
}

export function PoStatusButton({ poId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  if (currentStatus === "closed") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => setPoStatus(poId, "open"))}
      >
        {isPending ? "Updating..." : "Reopen"}
      </Button>
    );
  }

  if (currentStatus === "cancelled") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => setPoStatus(poId, "open"))}
      >
        {isPending ? "Updating..." : "Reinstate"}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => setPoStatus(poId, "closed"))}
      >
        {isPending ? "Updating..." : "Mark closed"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => setPoStatus(poId, "cancelled"))}
        className="text-destructive hover:text-destructive"
      >
        {isPending ? "Updating..." : "Cancel PO"}
      </Button>
    </div>
  );
}
