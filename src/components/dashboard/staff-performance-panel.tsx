"use client";

import { QrCard, QrCardHeading } from "@/components/design-system/qr-card";
import {
  formatResponseSeconds,
  type StaffPerformanceRow,
} from "@/lib/dashboard/staff-performance";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export function StaffPerformancePanel({
  rows,
  currency,
  loading,
}: {
  rows: StaffPerformanceRow[];
  currency: string;
  loading?: boolean;
}) {
  const avgResponse = rows.find((row) => row.avgResponseSeconds != null)
    ?.avgResponseSeconds;

  return (
    <QrCard variant="muted" padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <QrCardHeading>Staff performance</QrCardHeading>
        {!loading && avgResponse != null ? (
          <span className="text-xs text-dash-text-muted">
            Avg response {formatResponseSeconds(avgResponse)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-10 rounded-lg bg-dash-surface-raised"
            />
          ))}
        </div>
      ) : !rows.length ? (
        <p className="py-4 text-center text-sm text-dash-text-disabled">
          No staff orders recorded today.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 6).map((row) => (
            <li
              key={row.staffId}
              className="flex items-center justify-between gap-3 rounded-lg border border-dash-border/60 bg-dash-surface/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dash-text">
                  {row.staffName}
                </p>
                <p className="text-xs text-dash-text-muted">
                  {row.orderCount} orders ·{" "}
                  {formatPrice(row.revenue, currency)}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-dash-text-disabled">
                {formatResponseSeconds(row.avgResponseSeconds)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}
