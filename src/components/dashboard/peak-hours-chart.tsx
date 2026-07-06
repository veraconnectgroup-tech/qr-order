"use client";

import {
  formatPeakHourLabel,
  type PeakHourBucket,
} from "@/lib/dashboard/peak-hours";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

const WIDTH = 240;
const HEIGHT = 72;
const TOP_PADDING = 6;

function buildPaths(buckets: PeakHourBucket[]): { line: string; area: string } {
  if (buckets.length === 0) return { line: "", area: "" };

  const stepX = WIDTH / (buckets.length - 1);
  const points = buckets.map((bucket, index) => {
    const x = index * stepX;
    const y = HEIGHT - TOP_PADDING - bucket.intensity * (HEIGHT - TOP_PADDING * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${WIDTH.toFixed(1)},${HEIGHT} L0,${HEIGHT} Z`;

  return { line, area };
}

/** Replaces the old heatmap grid — same PeakHourBucket data, a trend line reads faster than 24 shaded squares. */
export function PeakHoursChart({
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
  const { line, area } = buildPaths(buckets);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <span className="overview-v3-zone-label">Revenue by hour</span>
        {!loading && peak.revenue > 0 ? (
          <span className="text-xs tabular-nums text-dash-text-muted">
            Peak {formatPeakHourLabel(peak.hour)} ·{" "}
            {formatPrice(peak.revenue, currency)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-full min-h-16 rounded-lg bg-dash-surface-raised" />
      ) : !activeHours.length ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-dash-text-disabled">
            No orders yet today.
          </p>
        </div>
      ) : (
        <div className="overview-v3-peak-grid flex min-h-0 flex-1 flex-col">
          <svg
            className="overview-v3-peak-chart w-full flex-1"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient
                id="overview-peak-gradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="var(--qr-ember)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--qr-ember)" stopOpacity="1" />
              </linearGradient>
              <linearGradient
                id="overview-peak-area-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="var(--qr-ember)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--qr-ember)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                className="overview-v3-peak-gridline"
                x1={0}
                x2={WIDTH}
                y1={HEIGHT * fraction}
                y2={HEIGHT * fraction}
              />
            ))}
            <path className="overview-v3-peak-area" d={area} />
            <path
              className="overview-v3-peak-line"
              d={line}
              style={{ vectorEffect: "non-scaling-stroke" }}
            />
          </svg>
          <div className="mt-2 flex shrink-0 justify-between text-[10px] text-dash-text-disabled">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}
    </div>
  );
}
