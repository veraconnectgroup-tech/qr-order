"use client";

import { cn } from "@/lib/utils";
import type { OrderMode } from "@/lib/denis/commerce/delivery-mode";
import type { PickupSlot } from "@/lib/denis/commerce/delivery-mode";

type Props = {
  orderMode: OrderMode;
  onOrderModeChange: (mode: OrderMode) => void;
  takeawayEnabled?: boolean;
  deliveryEnabled?: boolean;
  pickupSlots?: PickupSlot[];
  selectedPickupIndex?: number;
  onPickupIndexChange?: (index: number) => void;
  deliveryAddress?: string;
  onDeliveryAddressChange?: (address: string) => void;
  deliveryQuote?: string | null;
  deliveryError?: string | null;
  dineInLabel: string;
  takeawayLabel: string;
  deliveryLabel: string;
  pickupPrompt: string;
  className?: string;
};

export function OrderModeSelector({
  orderMode,
  onOrderModeChange,
  takeawayEnabled = true,
  deliveryEnabled = false,
  pickupSlots = [],
  selectedPickupIndex = 0,
  onPickupIndexChange,
  deliveryAddress = "",
  onDeliveryAddressChange,
  deliveryQuote,
  deliveryError,
  dineInLabel,
  takeawayLabel,
  deliveryLabel,
  pickupPrompt,
  className,
}: Props) {
  const modes: Array<{ id: OrderMode; label: string; enabled: boolean }> = [
    { id: "dine_in", label: dineInLabel, enabled: true },
    { id: "takeaway", label: takeawayLabel, enabled: takeawayEnabled },
    { id: "delivery", label: deliveryLabel, enabled: deliveryEnabled },
  ];

  return (
    <section
      className={cn("space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}
      aria-label="Order fulfillment mode"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {modes
          .filter((mode) => mode.enabled)
          .map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onOrderModeChange(mode.id)}
              className={cn(
                "min-h-12 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                orderMode === mode.id
                  ? "border-orange-500 bg-orange-500/15 text-orange-100"
                  : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
              )}
              aria-pressed={orderMode === mode.id}
            >
              {mode.label}
            </button>
          ))}
      </div>

      {orderMode === "takeaway" && pickupSlots.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-300">{pickupPrompt}</p>
          <div className="flex flex-wrap gap-2">
            {pickupSlots.map((slot, index) => (
              <button
                key={slot.pickupTime ?? slot.label}
                type="button"
                onClick={() => onPickupIndexChange?.(index)}
                className={cn(
                  "min-h-11 rounded-lg border px-3 py-2 text-xs font-medium",
                  selectedPickupIndex === index
                    ? "border-orange-500 bg-orange-500/10 text-orange-200"
                    : "border-zinc-700 text-zinc-400"
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {orderMode === "delivery" ? (
        <div className="space-y-2">
          <label className="text-sm text-zinc-300" htmlFor="delivery-address">
            Adresa dostave
          </label>
          <input
            id="delivery-address"
            type="text"
            value={deliveryAddress}
            onChange={(event) => onDeliveryAddressChange?.(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="Ulica i broj"
          />
          {deliveryQuote ? (
            <p className="text-sm text-orange-300">{deliveryQuote}</p>
          ) : null}
          {deliveryError ? (
            <p className="text-sm text-red-300">{deliveryError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
