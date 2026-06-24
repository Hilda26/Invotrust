"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  currentSearch: string;
  currentStatus: string | null;
}

export function VendorFilters({ currentSearch, currentStatus }: Props) {
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
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasFilters = currentSearch || currentStatus;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8 h-9"
          placeholder="Search vendor name..."
          defaultValue={currentSearch}
          onChange={(e) => {
            const v = e.target.value;
            clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._vendorSearchTimer);
            (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._vendorSearchTimer = setTimeout(
              () => setParam("q", v || null),
              300
            );
          }}
        />
      </div>

      <Select value={currentStatus ?? "all"} onValueChange={(v) => setParam("status", v === "all" ? null : v)}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="under_review">Under Review</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
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
