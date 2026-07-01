"use client";

import Link from "next/link";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardHeading } from "@/components/design-system/qr-card";
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
    <QrCard variant="muted" padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DenisMarkBadge size="sm" className="bg-dash-accent-muted ring-0" />
          <QrCardHeading>Denis activity</QrCardHeading>
        </div>
        <Link
          href="/dashboard/denis"
          className="text-xs font-medium text-[var(--qr-ember)] hover:text-[var(--qr-ember-hover)]"
        >
          Full log →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-10 rounded-lg bg-dash-surface-raised"
            />
          ))}
        </div>
      ) : !items.length ? (
        <p className="py-4 text-center text-sm text-dash-text-disabled">
          No Denis activity yet today.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-lg border border-dash-border/60 bg-dash-surface/50 px-3 py-2",
                item.priority === "critical" && "border-red-500/30 bg-red-500/5",
                item.priority === "high" && "border-amber-500/25"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-dash-text-secondary">{item.message}</p>
                <time
                  className="shrink-0 text-[10px] tabular-nums text-dash-text-disabled"
                  dateTime={item.createdAt}
                >
                  {formatActivityTime(item.createdAt)}
                </time>
              </div>
              {item.tableName ? (
                <p className="mt-1 text-xs text-dash-text-muted">
                  Table {item.tableName}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}
