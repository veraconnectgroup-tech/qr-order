"use client";

import { cn } from "@/lib/utils";
import type { OrderChannelDeliverySummary } from "@/types";

function getPosDelivery(
  deliveries: OrderChannelDeliverySummary[] | undefined
): OrderChannelDeliverySummary | null {
  if (!deliveries?.length) return null;
  return deliveries.find((row) => row.channel === "pos") ?? null;
}

type DeliveryStatusBadgeProps = {
  deliveries?: OrderChannelDeliverySummary[];
  light?: boolean;
  className?: string;
};

export function DeliveryStatusBadge({
  deliveries,
  light = false,
  className,
}: DeliveryStatusBadgeProps) {
  const pos = getPosDelivery(deliveries);
  if (!pos) return null;

  const { status, last_error: lastError } = pos;

  if (status === "delivered") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          light
            ? "bg-emerald-100 text-emerald-700"
            : "bg-emerald-500/15 text-emerald-400",
          className
        )}
        title="POS received order"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        POS
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          light
            ? "bg-amber-100 text-amber-800"
            : "bg-amber-500/15 text-amber-300",
          className
        )}
        title="POS delivery in progress"
      >
        <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
        POS…
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          light ? "bg-red-100 text-red-700" : "bg-red-500/15 text-red-400",
          className
        )}
        title={lastError?.trim() || "POS delivery failed"}
      >
        <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
        POS!
      </span>
    );
  }

  return null;
}

type TseStatusBadgeProps = {
  belegToken?: string | null;
  fiscalTssEnabled?: boolean;
  light?: boolean;
  className?: string;
};

export function TseStatusBadge({
  belegToken,
  fiscalTssEnabled = false,
  light = false,
  className,
}: TseStatusBadgeProps) {
  if (!fiscalTssEnabled) return null;

  if (belegToken) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          light
            ? "bg-emerald-100 text-emerald-700"
            : "bg-emerald-500/15 text-emerald-400",
          className
        )}
        title="Fiscal receipt (TSE) signed"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        TSE
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        light ? "bg-amber-100 text-amber-800" : "bg-amber-500/15 text-amber-300",
        className
      )}
      title="TSE signing pending"
    >
      <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
      TSE…
    </span>
  );
}
