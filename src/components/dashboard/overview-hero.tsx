"use client";

import type { ReactNode } from "react";
import { OverviewPctChange } from "@/components/dashboard/overview-pct-change";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type OverviewHeroProps = {
  locationName: string;
  currency: string;
  loading: boolean;
  revenue: number;
  orderCount: number;
  avgTicket: number;
  yesterdayRevenue: number;
  yesterdayOrderCount: number;
  yesterdayAvgTicket: number;
  activeSessions: number;
  totalTables: number;
};

function KpiCell({
  label,
  value,
  loading,
  delta,
  primary,
}: {
  label: string;
  value: string;
  loading?: boolean;
  delta?: ReactNode;
  primary?: boolean;
}) {
  return (
    <div className="overview-v3-kpi-cell">
      {loading ? (
        <>
          <Skeleton className="h-2 w-14 rounded bg-white/[0.06]" />
          <Skeleton className="h-6 w-20 rounded bg-white/[0.06]" />
        </>
      ) : (
        <>
          <p className="overview-v3-kpi-label">{label}</p>
          <div className="flex min-w-0 items-baseline gap-2">
            <p
              className={cn(
                "overview-v3-kpi-value overview-v3-kpi-value--compact truncate",
                primary && "overview-v3-kpi-value--primary"
              )}
            >
              {value}
            </p>
            {delta ? <div className="shrink-0">{delta}</div> : null}
          </div>
        </>
      )}
    </div>
  );
}

export function OverviewHero({
  locationName,
  currency,
  loading,
  revenue,
  orderCount,
  avgTicket,
  yesterdayRevenue,
  yesterdayOrderCount,
  yesterdayAvgTicket,
  activeSessions,
  totalTables,
}: OverviewHeroProps) {
  const { status } = useConnectionStatus();
  const liveOk = status === "online";

  return (
    <section className="overview-v3-hero shrink-0 border-b border-dash-border-subtle">
      <div className="flex min-h-[56px] flex-col lg:flex-row lg:items-stretch">
        <div className="flex shrink-0 items-center gap-3 border-b border-dash-border-subtle px-4 py-3 lg:border-b-0 lg:border-r lg:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-dash-text-disabled">
              Today&apos;s shift
            </p>
            <h1 className="truncate text-sm font-semibold tracking-tight text-dash-text">
              {locationName}
            </h1>
          </div>
          <span
            className={cn(
              "overview-v3-live-pill shrink-0",
              liveOk ? "overview-v3-live-pill--ok" : "overview-v3-live-pill--warn"
            )}
          >
            <span className="overview-v3-live-dot" />
            {liveOk ? "Live" : status}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col divide-y divide-dash-border-subtle sm:flex-row sm:divide-x sm:divide-y-0">
          <KpiCell
            label="Revenue"
            value={formatPrice(revenue, currency)}
            loading={loading}
            primary
            delta={
              loading ? undefined : (
                <OverviewPctChange
                  current={revenue}
                  previous={yesterdayRevenue}
                />
              )
            }
          />
          <KpiCell
            label="Orders"
            value={String(orderCount)}
            loading={loading}
            delta={
              loading ? undefined : (
                <OverviewPctChange
                  current={orderCount}
                  previous={yesterdayOrderCount}
                />
              )
            }
          />
          <KpiCell
            label="Avg ticket"
            value={formatPrice(avgTicket, currency)}
            loading={loading}
            delta={
              loading ? undefined : (
                <OverviewPctChange
                  current={avgTicket}
                  previous={yesterdayAvgTicket}
                />
              )
            }
          />
          <KpiCell
            label="Open tables"
            value={`${activeSessions} / ${totalTables}`}
            loading={loading}
          />
        </div>
      </div>
    </section>
  );
}
