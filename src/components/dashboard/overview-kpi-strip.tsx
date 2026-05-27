"use client";

import { FloorTile } from "@/components/design-system";
import { OverviewPctChange } from "@/components/dashboard/overview-pct-change";
import { OverviewSparkline } from "@/components/dashboard/overview-sparkline";
import type { OverviewSparklinePoint } from "@/lib/dashboard/overview-types";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type OverviewKpiStripProps = {
  currency: string;
  statsLoading: boolean;
  overviewLoading: boolean;
  sparkline: OverviewSparklinePoint[];
  todayRevenue: number;
  todayOrderCount: number;
  todayAvgTicket: number;
  yesterdayRevenue: number;
  yesterdayOrderCount: number;
  yesterdayAvgTicket: number;
  activeSessions: number;
  totalTables: number;
  pendingWaiterCalls: number;
};

function KpiTileSkeleton() {
  return <Skeleton className="h-[120px] min-w-[168px] shrink-0 rounded-xl bg-dash-surface-raised lg:min-w-0" />;
}

export function OverviewKpiStrip({
  currency,
  statsLoading,
  overviewLoading,
  sparkline,
  todayRevenue,
  todayOrderCount,
  todayAvgTicket,
  yesterdayRevenue,
  yesterdayOrderCount,
  yesterdayAvgTicket,
  activeSessions,
  totalTables,
  pendingWaiterCalls,
}: OverviewKpiStripProps) {
  const tileClass = "min-w-[168px] shrink-0 snap-start lg:min-w-0 lg:shrink";

  if (statsLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiTileSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
      <FloorTile
        variant="kpi"
        compact
        label="Revenue today"
        value={formatPrice(todayRevenue, currency)}
        className={cn(tileClass, "lg:col-span-1")}
      >
        <OverviewPctChange current={todayRevenue} previous={yesterdayRevenue} />
        <div className="mt-2">
          <OverviewSparkline
            inline
            data={sparkline}
            currency={currency}
            loading={overviewLoading}
          />
        </div>
      </FloorTile>

      <FloorTile
        variant="kpi"
        compact
        label="Orders today"
        value={String(todayOrderCount)}
        className={tileClass}
      >
        <OverviewPctChange
          current={todayOrderCount}
          previous={yesterdayOrderCount}
        />
      </FloorTile>

      <FloorTile
        variant="kpi"
        compact
        label="Avg ticket"
        value={formatPrice(todayAvgTicket, currency)}
        className={tileClass}
      >
        <OverviewPctChange
          current={todayAvgTicket}
          previous={yesterdayAvgTicket}
        />
      </FloorTile>

      <FloorTile
        variant="kpi"
        compact
        label="Open tables"
        value={`${activeSessions} / ${totalTables}`}
        className={tileClass}
        sublabel="Active sessions"
      />

      <FloorTile
        variant="kpi"
        compact
        label="Waiter calls"
        value={String(pendingWaiterCalls)}
        className={tileClass}
        status={pendingWaiterCalls > 0 ? "selected" : "available"}
      />
    </div>
  );
}
