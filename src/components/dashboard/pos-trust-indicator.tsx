"use client";

import { Check } from "lucide-react";
import { formatOrderNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PosTrustPhase = "saved" | "kitchen" | "confirmed";

export type PosTrustOrder = {
  clientOrderId: string;
  tableName: string;
  phase: PosTrustPhase;
  orderNumber?: number;
};

const KITCHEN_ASSUME_MS = 2000;

type PosTrustIndicatorProps = {
  orders: PosTrustOrder[];
  onDismiss?: (clientOrderId: string) => void;
};

function phaseDone(order: PosTrustOrder, step: PosTrustPhase): boolean {
  if (step === "saved") return true;
  if (step === "kitchen") {
    return order.phase === "kitchen" || order.phase === "confirmed";
  }
  return order.phase === "confirmed";
}

function TrustStep({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-sm transition-colors",
        done ? "text-emerald-400" : active ? "text-dash-text" : "text-dash-text-disabled"
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-emerald-500/50 bg-emerald-500/15"
            : active
              ? "border-dash-accent/50 bg-dash-accent/10"
              : "border-dash-border bg-dash-surface"
        )}
      >
        {done ? <Check className="size-3" aria-hidden /> : null}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function PosTrustIndicator({ orders }: PosTrustIndicatorProps) {
  if (orders.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex max-w-sm flex-col gap-2">
      {orders.map((order) => {
        const confirmedLabel =
          order.orderNumber != null
            ? `Bestätigt #${formatOrderNumber(order.orderNumber)} ✓`
            : "Bestätigt ✓";

        return (
          <div
            key={order.clientOrderId}
            className="rounded-xl border border-dash-border bg-dash-surface/95 px-4 py-3 shadow-lg backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-dash-text-disabled">
              {order.tableName}
            </p>
            <ol className="space-y-1.5">
              <TrustStep
                label="Gespeichert ✓"
                done={phaseDone(order, "saved")}
                active={order.phase === "saved"}
              />
              <TrustStep
                label="Küche sieht ✓"
                done={phaseDone(order, "kitchen")}
                active={order.phase === "kitchen"}
              />
              <TrustStep
                label={confirmedLabel}
                done={phaseDone(order, "confirmed")}
                active={order.phase === "confirmed"}
              />
            </ol>
          </div>
        );
      })}
    </div>
  );
}

export function advanceTrustToKitchen(clientOrderId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("pos-trust:kitchen", { detail: { clientOrderId } })
  );
}

export function scheduleKitchenTrustAssume(clientOrderId: string): () => void {
  const timer = setTimeout(() => advanceTrustToKitchen(clientOrderId), KITCHEN_ASSUME_MS);
  return () => clearTimeout(timer);
}
