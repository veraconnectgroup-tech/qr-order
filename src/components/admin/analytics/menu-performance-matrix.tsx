"use client";

import { ChartCard } from "@/components/admin/analytics/chart-card";
import type { MenuPerformanceMatrixSnapshot } from "@/lib/analytics/admin-intelligence/types";
import { formatPrice } from "@/lib/format";

export function MenuPerformanceMatrix({
  data,
  currency,
  className,
}: {
  data: MenuPerformanceMatrixSnapshot;
  currency: string;
  className?: string;
}) {
  return (
    <ChartCard
      title="Menu performance matrix"
      description="Orders, revenue, prep time, margin proxy, satisfaction, return rate"
      className={className}
    >
      {data.boostCandidates.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Denis boost candidates:{" "}
          {data.boostCandidates
            .slice(0, 3)
            .map((row) => row.name)
            .join(", ")}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pe-3">#</th>
              <th className="py-2 pe-3">Item</th>
              <th className="py-2 pe-3">Orders</th>
              <th className="py-2 pe-3">Revenue</th>
              <th className="py-2 pe-3">Prep</th>
              <th className="py-2 pe-3">Margin</th>
              <th className="py-2 pe-3">Sat.</th>
              <th className="py-2 pe-3">Return</th>
            </tr>
          </thead>
          <tbody>
            {data.items.slice(0, 15).map((row) => (
              <tr key={row.productId} className="border-b border-border/60">
                <td className="py-2 pe-3 tabular-nums text-muted-foreground">
                  {row.rank}
                </td>
                <td className="py-2 pe-3">
                  <p className="font-medium text-foreground">{row.name}</p>
                  {row.suggestion ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.suggestion}
                    </p>
                  ) : null}
                </td>
                <td className="py-2 pe-3 tabular-nums">{row.orderCount}</td>
                <td className="py-2 pe-3 tabular-nums">
                  {formatPrice(row.revenue, currency)}
                </td>
                <td className="py-2 pe-3 tabular-nums">
                  {row.prepTimeMinutes != null ? `${row.prepTimeMinutes}m` : "—"}
                </td>
                <td className="py-2 pe-3 tabular-nums">
                  {row.profitMarginPct != null ? `${row.profitMarginPct}%` : "—"}
                </td>
                <td className="py-2 pe-3 tabular-nums">
                  {row.satisfactionPct != null ? `${row.satisfactionPct}%` : "—"}
                </td>
                <td className="py-2 pe-3 tabular-nums">
                  {row.returnRatePct != null ? `${row.returnRatePct}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
