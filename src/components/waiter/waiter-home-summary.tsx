"use client";

import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

export function WaiterHomeSummary() {
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();

  const chips = [
    {
      label: "Orders",
      count: pendingOrders + pendingPaymentRequests,
      tone: "text-dash-accent",
    },
    {
      label: "Calls",
      count: pendingWaiterCalls,
      tone: "text-red-400",
    },
    {
      label: "Payments",
      count: pendingPaymentRequests,
      tone: "text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="rounded-xl border border-dash-border-subtle bg-dash-surface px-3 py-3 text-center"
        >
          <p className={`font-mono text-xl font-bold tabular-nums ${chip.tone}`}>
            {chip.count}
          </p>
          <p className="text-[11px] text-dash-text-muted">{chip.label}</p>
        </div>
      ))}
    </div>
  );
}
