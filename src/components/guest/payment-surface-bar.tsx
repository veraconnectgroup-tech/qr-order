"use client";

import { CreditCard, Smartphone, Wallet } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { resolveGuestPaymentSurfaceLabels } from "@/lib/denis/commerce/payment-intelligence";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";

export function PaymentSurfaceBar({
  availableMethods,
}: {
  availableMethods: SelectablePaymentMethod[];
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const labels = resolveGuestPaymentSurfaceLabels({
    availableMethods,
    language,
  });

  if (!labels) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5"
      role="note"
      aria-label={tUI("payment.method")}
    >
      <CreditCard className="size-4 shrink-0 text-orange-500" aria-hidden />
      <Smartphone className="size-4 shrink-0 text-zinc-500" aria-hidden />
      <Wallet className="size-4 shrink-0 text-zinc-500" aria-hidden />
      <p className="min-w-0 flex-1 text-xs leading-snug text-zinc-400">
        {labels}
      </p>
    </div>
  );
}
