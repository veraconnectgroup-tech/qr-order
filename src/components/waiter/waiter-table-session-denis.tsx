"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { WaiterTableSessionView } from "@/lib/denis/venue/copilot/waiter-copilot-types";
import { cn } from "@/lib/utils";

type Props = {
  tableId: string;
};

function urgencyBorder(urgency: WaiterTableSessionView["urgency"]) {
  switch (urgency) {
    case "red":
      return "border-l-red-500";
    case "yellow":
      return "border-l-yellow-500";
    case "green":
      return "border-l-emerald-500";
  }
}

export function WaiterTableSessionDenis({ tableId }: Props) {
  const { aiConciergeEnabled } = useDashboard();
  const [view, setView] = useState<WaiterTableSessionView | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!aiConciergeEnabled) {
      setView(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/waiter/denis-copilot/${tableId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setView(null);
        return;
      }
      const json = await res.json();
      setView(json.data as WaiterTableSessionView);
    } finally {
      setLoading(false);
    }
  }, [aiConciergeEnabled, tableId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!aiConciergeEnabled) return null;

  if (loading) {
    return <Skeleton className="h-32 rounded-xl bg-dash-surface-raised" />;
  }

  if (!view?.enabled) return null;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border border-dash-border-subtle border-l-4 bg-dash-surface p-4",
          urgencyBorder(view.urgency)
        )}
      >
        <div className="flex items-start gap-2.5">
          <DenisMarkBadge size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-dash-text">Denis summary</p>
            {view.summary ? (
              <p className="mt-1 text-sm text-dash-text-secondary">{view.summary}</p>
            ) : null}
            {view.suggestedAction ? (
              <p className="mt-1 text-xs font-medium text-dash-accent">
                → {view.suggestedAction}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {view.deviceOrders.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            Narudžbine po uređaju
          </p>
          {view.deviceOrders.map((group) => (
            <div
              key={group.deviceFingerprint ?? group.deviceLabel}
              className="rounded-xl border border-dash-border-subtle bg-dash-surface p-3"
            >
              <p className="text-sm font-semibold text-dash-text">{group.deviceLabel}</p>
              <div className="mt-2 space-y-2">
                {group.orders.map((order) => (
                  <div key={order.orderId} className="text-sm text-dash-text-secondary">
                    <p>
                      #{order.orderNumber} · {order.status}
                    </p>
                    <p className="text-xs text-dash-text-muted">
                      {order.items
                        .map((item) => `${item.quantity}× ${item.productName}`)
                        .join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {view.denisTimeline.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            Denis timeline
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-dash-border-subtle bg-dash-surface p-3">
            {view.denisTimeline.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="text-sm">
                <p className="text-[11px] text-dash-text-disabled">
                  {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
                </p>
                <p className="text-dash-text-secondary">{entry.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
