"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { resolvePaymentSuggestion } from "@/lib/denis/commerce/payment-intelligence";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import { PaymentSurfaceBar } from "@/components/guest/payment-surface-bar";

export function CheckoutPaymentHint({
  orderTotal,
  availableMethods,
}: {
  orderTotal: number;
  availableMethods: SelectablePaymentMethod[];
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const suggestion = resolvePaymentSuggestion({
    amountDue: orderTotal,
    language,
    availableMethods,
  });

  return (
    <div className="mt-4 space-y-2">
      <PaymentSurfaceBar availableMethods={availableMethods} />
      {suggestion ? (
        <p className="text-sm text-zinc-400">{suggestion.message}</p>
      ) : null}
    </div>
  );
}
