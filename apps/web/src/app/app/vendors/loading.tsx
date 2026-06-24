import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function VendorsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
      </div>
      <Card>
        <CardContent className="px-0 flex flex-col gap-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-border px-4 py-3.5 grid grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
