"use client";

import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { SceneSituation } from "@/lib/scene/types";

const STATUS_KEYS: Record<string, string> = {
  pending: "order.status.pending",
  confirmed: "order.status.accepted",
  accepted: "order.status.accepted",
  preparing: "order.status.preparing",
  ready: "order.status.ready",
  delivered: "order.status.delivered",
};

export function DenisSituationView({
  situation,
}: {
  situation: SceneSituation;
}) {
  const { tUI } = useAppLocale();

  return (
    <div className="space-y-2 px-3 pb-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qr-ember)]/85">
        {tUI("scene.situation.title")}
      </p>
      <ul className="space-y-2">
        {situation.orders.map((order) => {
          const statusKey = STATUS_KEYS[order.status] ?? "order.status.pending";
          return (
            <li
              key={order.orderId}
              className="flex items-start gap-2.5 rounded-lg border border-[var(--qr-elevated)] bg-[var(--qr-void)]/60 px-3 py-2.5"
            >
              <DenisTableMark
                size={24}
                state={order.status === "ready" ? "listen" : "idle"}
                className="mt-0.5 size-5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--qr-ivory)]">
                  {order.itemsLabel}
                  {order.orderNumber > 0 ? (
                    <span className="ms-2 text-[11px] font-normal text-[var(--qr-muted)]">
                      #{order.orderNumber}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--qr-muted)]">
                  {tUI(statusKey as "order.status.preparing")}
                  {order.prepMinutes && order.status === "preparing"
                    ? ` · ~${order.prepMinutes} min`
                    : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
