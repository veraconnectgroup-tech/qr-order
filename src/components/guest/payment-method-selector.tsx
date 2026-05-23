"use client";

import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { PaymentMethod } from "@/lib/constants";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  inPersonPaymentKeys,
  type TranslationKey,
} from "@/lib/i18n/translations";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

const ICONS = {
  online: Smartphone,
  at_bar: Banknote,
  card_at_table: CreditCard,
} as const;

function getMethodCopy(
  method: SelectablePaymentMethod,
  inPersonPaymentLocation: InPersonPaymentLocation,
  tUI: (key: TranslationKey | string) => string
) {
  if (method === "online") {
    return {
      title: tUI("payment.online.title"),
      description: tUI("payment.online.description"),
    };
  }
  if (method === "card_at_table") {
    return {
      title: tUI("payment.cardAtTable.title"),
      description: tUI("payment.cardAtTable.description"),
    };
  }
  const keys = inPersonPaymentKeys(inPersonPaymentLocation);
  return {
    title: tUI(keys.title),
    description: tUI(keys.description),
  };
}

export function PaymentMethodSelector({
  methods,
  value,
  onChange,
  inPersonPaymentLocation = "bar",
}: {
  methods: SelectablePaymentMethod[];
  value: PaymentMethod | null;
  onChange: (method: SelectablePaymentMethod) => void;
  inPersonPaymentLocation?: InPersonPaymentLocation;
}) {
  const { tUI } = useAppLocale();

  return (
    <div className="space-y-2">
      <h2 className="text-caption uppercase tracking-wide text-zinc-500">
        {tUI("payment.method")}
      </h2>
      <div className="space-y-2">
        {methods.map((method) => {
          const option = getMethodCopy(method, inPersonPaymentLocation, tUI);
          const Icon = ICONS[method];
          const selected = value === method;

          return (
            <button
              key={method}
              type="button"
              onClick={() => onChange(method)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-4 text-start transition",
                selected
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                  selected
                    ? "bg-orange-500 text-white"
                    : "bg-zinc-800 text-zinc-400"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-100">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                  {option.description}
                </span>
              </span>
              <span
                className={cn(
                  "mt-1 size-4 shrink-0 rounded-full border-2",
                  selected
                    ? "border-orange-500 bg-orange-500"
                    : "border-zinc-600 bg-transparent"
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
