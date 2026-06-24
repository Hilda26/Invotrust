import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { AnomalyFlag } from "@/types/domain";
import { cn } from "@/lib/utils";

const SEVERITY_ICON = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
};

const SEVERITY_STYLES = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export function AnomalyFlagList({ flags }: { flags: AnomalyFlag[] }) {
  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No anomalies detected.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {flags.map((flag, i) => {
        const Icon = SEVERITY_ICON[flag.severity];
        return (
          <li key={i} className="flex items-start gap-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", SEVERITY_STYLES[flag.severity])} />
            <div>
              <p className="text-sm font-medium capitalize">{flag.type.replaceAll("_", " ")}</p>
              <p className="text-sm text-muted-foreground">{flag.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
