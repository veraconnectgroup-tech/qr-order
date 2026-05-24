"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { createClient } from "@/lib/supabase/client";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  getStaffSelectablePaymentMethods,
  paymentMethodLabel,
  type StaffSelectablePaymentMethod,
} from "@/lib/payment-methods";
import { patchOrderPaymentMethod } from "@/lib/orders/patch-order-payment-method";
import { cn } from "@/lib/utils";

type LocationPaymentSettings = {
  payment_online_enabled: boolean;
  payment_at_bar_enabled: boolean;
  payment_card_at_table_enabled: boolean;
};

type Props = {
  orderId: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  inPersonPaymentLocation?: InPersonPaymentLocation;
  disabled?: boolean;
  light?: boolean;
  className?: string;
  onOptimisticChange?: (method: StaffSelectablePaymentMethod) => void;
};

export function OrderPaymentMethodSelect({
  orderId,
  paymentMethod,
  paymentStatus,
  orderStatus,
  inPersonPaymentLocation = "bar",
  disabled = false,
  light = false,
  className,
  onOptimisticChange,
}: Props) {
  const { locationId, stripeOnboarded } = useDashboard();
  const [settings, setSettings] = useState<LocationPaymentSettings | null>(
    null
  );
  const [localMethod, setLocalMethod] = useState(paymentMethod);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalMethod(paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("locations")
        .select(
          "payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
        )
        .eq("id", locationId)
        .maybeSingle();

      if (!cancelled && data) {
        setSettings(data as LocationPaymentSettings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const availableMethods = useMemo(() => {
    if (!settings) return [] as StaffSelectablePaymentMethod[];
    return getStaffSelectablePaymentMethods({
      stripeOnboarded,
      paymentOnlineEnabled: settings.payment_online_enabled,
      paymentAtBarEnabled: settings.payment_at_bar_enabled,
      paymentCardAtTableEnabled: settings.payment_card_at_table_enabled,
    });
  }, [settings, stripeOnboarded]);

  const visible =
    paymentStatus !== "paid" &&
    orderStatus !== "cancelled" &&
    orderStatus !== "rejected" &&
    availableMethods.length > 0;

  const applyMethod = useCallback(
    async (next: StaffSelectablePaymentMethod) => {
      if (next === localMethod || busy) return;

      const previous = localMethod;
      setLocalMethod(next);
      setBusy(true);
      onOptimisticChange?.(next);

      try {
        await patchOrderPaymentMethod(orderId, next);
      } catch (error) {
        setLocalMethod(previous);
        onOptimisticChange?.(previous as StaffSelectablePaymentMethod);
        toast.error(
          error instanceof Error ? error.message : "Could not update payment method"
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, localMethod, onOptimisticChange, orderId]
  );

  if (!visible) return null;

  const currentValue = availableMethods.includes(
    localMethod as StaffSelectablePaymentMethod
  )
    ? (localMethod as StaffSelectablePaymentMethod)
    : availableMethods[0];

  return (
    <div className={cn("space-y-1", className)}>
      <label
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          light ? "text-zinc-500" : "text-dash-text-disabled"
        )}
      >
        Payment method
      </label>
      <Select
        value={currentValue}
        disabled={disabled || busy || !settings}
        onValueChange={(value) =>
          void applyMethod(value as StaffSelectablePaymentMethod)
        }
      >
        <SelectTrigger
          className={cn(
            "h-10 w-full min-h-12 touch-manipulation",
            light
              ? "border-zinc-200 bg-white text-zinc-900"
              : "border-dash-border bg-dash-bg text-dash-text"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className={
            light
              ? "border-zinc-200 bg-white text-zinc-900"
              : "border-dash-surface-overlay bg-dash-surface text-dash-text"
          }
        >
          {availableMethods.map((method) => (
            <SelectItem key={method} value={method}>
              {paymentMethodLabel(method, inPersonPaymentLocation)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
