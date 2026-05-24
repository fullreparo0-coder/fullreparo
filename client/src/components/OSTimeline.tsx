import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  status: string;
  notes?: string | null;
  changedByName?: string | null;
  createdAt: Date | string;
}

interface OSTimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

export function OSTimeline({ entries, className }: OSTimelineProps) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {sorted.map((entry, idx) => (
          <div key={idx} className="relative flex gap-4 pl-10">
            <div
              className={cn(
                "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background text-xs font-bold",
                idx === sorted.length - 1
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {idx + 1}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <StatusBadge status={entry.status} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("pt-BR")}
                </span>
                {entry.changedByName && (
                  <span className="text-xs text-muted-foreground">· {entry.changedByName}</span>
                )}
              </div>
              {entry.notes && (
                <p className="text-sm text-foreground/80 mt-1">{entry.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
