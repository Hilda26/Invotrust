import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}

export function Pagination({ page, pageSize, total, buildHref }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
      <span>
        {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Button nativeButton={false} variant="ghost" size="icon" className="size-8" render={<Link href={buildHref(page - 1)} />}>
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="size-8" disabled>
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <span className="w-16 text-center tabular-nums">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Button nativeButton={false} variant="ghost" size="icon" className="size-8" render={<Link href={buildHref(page + 1)} />}>
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="size-8" disabled>
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
