"use client";

import { useMemo, useState } from "react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { clampTipAmount } from "@/lib/orders/tips";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type TipMode = "fixed" | "percent";

const FIXED_AMOUNTS = [1, 2, 5] as const;
const PERCENT_PRESETS = [5, 10, 15] as const;

export function TipSelector({
  subtotal,
  orderTotal,
  currency,
  value,
  onChange,
}: {
  /** Base for percentage tips (excl. tax). */
  subtotal: number;
  /** Order total incl. tax — shown with tip. */
  orderTotal: number;
  currency: string;
  value: number;
  onChange: (amount: number) => void;
}) {
  const { tUI } = useAppLocale();
  const [mode, setMode] = useState<TipMode>("fixed");
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const percentAmounts = useMemo(
    () =>
      PERCENT_PRESETS.map((pct) => ({
        pct,
        amount: clampTipAmount(
          Math.round(subtotal * (pct / 100) * 100) / 100,
          orderTotal
        ),
      })),
    [subtotal, orderTotal]
  );

  const activeFixed = FIXED_AMOUNTS.find((a) => Math.abs(a - value) < 0.01);
  const activePercent = percentAmounts.find(
    (p) => p.amount > 0 && Math.abs(p.amount - value) < 0.01
  );

  function selectAmount(amount: number) {
    setCustomOpen(false);
    onChange(clampTipAmount(amount, orderTotal));
  }

  function switchMode(next: TipMode) {
    setMode(next);
    setCustomOpen(false);
    onChange(0);
  }

  function applyCustom() {
    const parsed = Number.parseFloat(customInput.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) return;
    selectAmount(parsed);
    setCustomOpen(false);
  }

  const grandTotal = orderTotal + value;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">{tUI("tip.title")}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{tUI("tip.hint")}</p>
        </div>
        <div className="flex shrink-0 rounded-lg border border-zinc-700 p-0.5">
          <button
            type="button"
            onClick={() => switchMode("fixed")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition",
              mode === "fixed"
                ? "bg-orange-500 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tUI("tip.modeFixed")}
          </button>
          <button
            type="button"
            onClick={() => switchMode("percent")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition",
              mode === "percent"
                ? "bg-orange-500 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tUI("tip.modePercent")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectAmount(0)}
          className={cn(
            "rounded-full border px-3 py-2 text-sm font-medium transition touch-manipulation",
            value === 0 && !customOpen
              ? "border-orange-500 bg-orange-500/15 text-orange-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
          )}
        >
          {tUI("tip.none")}
        </button>

        {mode === "fixed"
          ? FIXED_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => selectAmount(amount)}
                className={cn(
                  "rounded-full border px-3 py-2 text-sm font-medium transition touch-manipulation",
                  activeFixed === amount && !customOpen
                    ? "border-orange-500 bg-orange-500/15 text-orange-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                )}
              >
                {formatPrice(amount, currency)}
              </button>
            ))
          : percentAmounts.map(({ pct, amount }) => (
              <button
                key={pct}
                type="button"
                onClick={() => selectAmount(amount)}
                className={cn(
                  "rounded-full border px-3 py-2 text-sm font-medium transition touch-manipulation",
                  activePercent?.pct === pct && !customOpen
                    ? "border-orange-500 bg-orange-500/15 text-orange-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                )}
              >
                {pct}% · {formatPrice(amount, currency)}
              </button>
            ))}

        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={cn(
            "rounded-full border px-3 py-2 text-sm font-medium transition touch-manipulation",
            customOpen || (value > 0 && !activeFixed && !activePercent)
              ? "border-orange-500 bg-orange-500/15 text-orange-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
          )}
        >
          {tUI("tip.custom")}
        </button>
      </div>

      {customOpen && (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={
              mode === "fixed"
                ? formatPrice(2, currency)
                : formatPrice(subtotal * 0.1, currency)
            }
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
          >
            {tUI("common.confirm")}
          </button>
        </div>
      )}

      {value > 0 && (
        <div className="space-y-1 border-t border-zinc-800 pt-3 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>{tUI("checkout.tip")}</span>
            <span className="tabular-nums">{formatPrice(value, currency)}</span>
          </div>
          <div className="flex justify-between font-semibold text-zinc-50">
            <span>{tUI("checkout.totalWithTip")}</span>
            <span className="tabular-nums">{formatPrice(grandTotal, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
