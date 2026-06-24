"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InvoiceStatus } from "@/types/domain";

interface Props {
  currentSearch: string;
  currentStatus: InvoiceStatus | null;
  currentRisk: string | null;
}

export function InvoiceFilters({ currentSearch, currentStatus, currentRisk }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const hasFilters = currentSearch || currentStatus || currentRisk;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8 h-9"
          placeholder="Search invoice number..."
          defaultValue={currentSearch}
          onChange={(e) => {
            const v = e.target.value;
            clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._invoiceSearchTimer);
            (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._invoiceSearchTimer = setTimeout(
              () => setParam("q", v || null),
              300,
            );
          }}
        />
      </div>

      <Select
        value={currentStatus ?? "all"}
        onValueChange={(v) => setParam("status", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="submitted_to_genlayer">Validating</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="escalated">Escalated</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={currentRisk ?? "all"}
        onValueChange={(v) => setParam("risk", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="All risk" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All risk</SelectItem>
          <SelectItem value="low">Low (0-39)</SelectItem>
          <SelectItem value="medium">Medium (40-69)</SelectItem>
          <SelectItem value="high">High (70+)</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
          onClick={() => router.push(pathname)}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
