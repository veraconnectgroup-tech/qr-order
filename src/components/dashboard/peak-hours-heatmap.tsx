"use client";

import { QrCard, QrCardHeading } from "@/components/design-system/qr-card";
import {
  formatPeakHourLabel,
  type PeakHourBucket,
} from "@/lib/dashboard/peak-hours";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PeakHoursHeatmap({
  buckets,
  currency,
  loading,
}: {
  buckets: PeakHourBucket[];
  currency: string;
  loading?: boolean;
}) {
  const activeHours = buckets.filter(
    (bucket) => bucket.orderCount > 0 || bucket.revenue > 0
  );
  const peak = buckets.reduce(
    (best, bucket) => (bucket.revenue > best.revenue ? bucket : best),
    buckets[0] ?? { hour: 0, revenue: 0, orderCount: 0, intensity: 0 }
  );

  return (
    <QrCard variant="muted" padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <QrCardHeading>Peak hours today</QrCardHeading>
        {!loading && peak.revenue > 0 ? (
          <span className="text-xs tabular-nums text-dash-text-muted">
            Peak {formatPeakHourLabel(peak.hour)} ·{" "}
            {formatPrice(peak.revenue, currency)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-24 rounded-lg bg-dash-surface-raised" />
      ) : !activeHours.length ? (
        <p className="py-6 text-center text-sm text-dash-text-disabled">
          No orders yet today.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-1">
            {buckets.map((bucket) => (
              <div
                key={bucket.hour}
                title={`${formatPeakHourLabel(bucket.hour)} — ${bucket.orderCount} orders · ${formatPrice(bucket.revenue, currency)}`}
                className={cn(
                  "aspect-square rounded-sm transition-colors",
                  bucket.intensity > 0
                    ? "bg-[var(--qr-ember)]"
                    : "bg-dash-surface-raised"
                )}
                style={{
                  opacity: bucket.intensity > 0 ? 0.25 + bucket.intensity * 0.75 : 0.35,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-dash-text-disabled">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}
    </QrCard>
  );
}
