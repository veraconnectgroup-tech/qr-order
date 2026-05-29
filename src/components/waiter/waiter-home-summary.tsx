"use client";

import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";

export function WaiterHomeSummary() {
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();
  const { t } = useWaiterI18n();

  const chips = [
    {
      label: t("summary.orders"),
      count: pendingOrders,
      tone: "text-dash-accent",
    },
    {
      label: t("summary.calls"),
      count: pendingWaiterCalls,
      tone: "text-red-400",
    },
    {
      label: t("summary.payments"),
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
