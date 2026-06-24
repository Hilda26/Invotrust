import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditLogsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card>
        <CardContent className="px-0 flex flex-col gap-0">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-b border-border px-4 py-3.5 grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
