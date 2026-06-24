import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function InvoiceDetailLoading() {
  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="aspect-3/4 w-full rounded-md" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Skeleton className="h-10 w-80" />
          <Card>
            <CardContent className="py-6 flex flex-col gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
