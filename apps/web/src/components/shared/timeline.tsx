import { Link2 } from "lucide-react";
import type { AuditLogEntry } from "@/types/domain";

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Timeline({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">
          {i < entries.length - 1 && (
            <span className="absolute left-[5px] top-3 h-full w-px bg-border" aria-hidden />
          )}
          <span className="relative mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</p>
              <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{entry.details}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{entry.actor}</span>
              {entry.onChain && (
                <span className="inline-flex items-center gap-1 text-genlayer">
                  <Link2 className="size-3" /> On-chain
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
