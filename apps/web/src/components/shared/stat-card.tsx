import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" | "flat"; positive?: boolean };
  accent?: "default" | "destructive" | "warning" | "success" | "genlayer";
}

const ACCENT_STYLES: Record<string, string> = {
  default: "text-primary bg-primary/10",
  destructive: "text-destructive bg-destructive/10",
  warning: "text-warning bg-warning/10",
  success: "text-success bg-success/10",
  genlayer: "text-genlayer bg-genlayer/10",
};

export function StatCard({ label, value, icon: Icon, trend, accent = "default" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend.positive === false ? "text-destructive" : trend.positive === true ? "text-success" : "text-muted-foreground",
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ACCENT_STYLES[accent])}>
            <Icon className="size-4.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
