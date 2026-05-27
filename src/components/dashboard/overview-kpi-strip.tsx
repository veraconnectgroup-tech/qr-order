"use client";

import { QrKpi } from "@/components/design-system/qr-kpi";
import { OverviewPctChange } from "@/components/dashboard/overview-pct-change";
import { OverviewSparkline } from "@/components/dashboard/overview-sparkline";
import type { OverviewSparklinePoint } from "@/lib/dashboard/overview-types";
import { formatPrice } from "@/lib/format";
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

const tileClass = "min-w-[168px] shrink-0 snap-start lg:min-w-0 lg:shrink";

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
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
      <QrKpi
        label="Revenue today"
        value={formatPrice(todayRevenue, currency)}
        loading={statsLoading}
        className={tileClass}
        delta={
          statsLoading ? undefined : (
            <OverviewPctChange
              current={todayRevenue}
              previous={yesterdayRevenue}
            />
          )
        }
        footer={
          statsLoading ? undefined : (
            <OverviewSparkline
              inline
              data={sparkline}
              currency={currency}
              loading={overviewLoading}
            />
          )
        }
      />

      <QrKpi
        label="Orders today"
        value={String(todayOrderCount)}
        loading={statsLoading}
        className={tileClass}
        delta={
          statsLoading ? undefined : (
            <OverviewPctChange
              current={todayOrderCount}
              previous={yesterdayOrderCount}
            />
          )
        }
      />

      <QrKpi
        label="Avg ticket"
        value={formatPrice(todayAvgTicket, currency)}
        loading={statsLoading}
        className={tileClass}
        delta={
          statsLoading ? undefined : (
            <OverviewPctChange
              current={todayAvgTicket}
              previous={yesterdayAvgTicket}
            />
          )
        }
      />

      <QrKpi
        label="Open tables"
        value={`${activeSessions} / ${totalTables}`}
        sublabel="Active sessions"
        loading={statsLoading}
        className={tileClass}
      />

      <QrKpi
        label="Waiter calls"
        value={String(pendingWaiterCalls)}
        loading={statsLoading}
        accent={!statsLoading && pendingWaiterCalls > 0}
        className={cn(tileClass)}
      />
    </div>
  );
}
