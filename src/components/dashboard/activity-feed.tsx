"use client";

import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import type { StaffNotificationRow } from "@/lib/denis/notifications/persist-staff-notification";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatActivityTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityFeed({
  items,
  loading,
}: {
  items: StaffNotificationRow[];
  loading?: boolean;
}) {
  return (
    <div className="h-full overflow-y-auto">
      {loading ? (
        <div className="space-y-2 py-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-10 rounded-lg bg-dash-surface-raised"
            />
          ))}
        </div>
      ) : !items.length ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <DenisMarkBadge
            size="sm"
            className="bg-dash-accent-muted opacity-60 ring-0"
          />
          <p className="text-sm text-dash-text-disabled">
            No Denis activity yet today.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-dash-border-subtle">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "overview-v3-activity-row",
                item.priority === "critical" &&
                  "overview-v3-activity-row--critical",
                item.priority === "high" && "overview-v3-activity-row--high"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-dash-text-secondary">
                  {item.message}
                </p>
                <time
                  className="shrink-0 text-[10px] tabular-nums text-dash-text-disabled"
                  dateTime={item.createdAt}
                >
                  {formatActivityTime(item.createdAt)}
                </time>
              </div>
              {item.tableName ? (
                <p className="mt-0.5 text-xs text-dash-text-muted">
                  Table {item.tableName}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
