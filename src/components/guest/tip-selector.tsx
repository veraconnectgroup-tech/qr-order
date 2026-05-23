"use client";

import { useMemo, useState } from "react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRESET_PERCENTS = [0, 10, 15, 20] as const;

export function TipSelector({
  amountDue,
  currency,
  value,
  onChange,
}: {
  amountDue: number;
  currency: string;
  value: number;
  onChange: (amount: number) => void;
}) {
  const { tUI } = useAppLocale();
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const presetAmounts = useMemo(
    () =>
      PRESET_PERCENTS.map((pct) => ({
        pct,
        amount: pct === 0 ? 0 : Math.round(amountDue * (pct / 100) * 100) / 100,
      })),
    [amountDue]
  );

  const activePreset = presetAmounts.find(
    (p) => p.pct > 0 && Math.abs(p.amount - value) < 0.01
  );

  function applyCustom() {
    const parsed = Number.parseFloat(customInput.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) return;
    const capped = Math.min(parsed, amountDue * 0.5);
    onChange(Math.round(capped * 100) / 100);
    setCustomOpen(false);
  }

  return (
    <div className="mt-5 space-y-3">
      <div>
        <h3 className="text-caption uppercase tracking-wide text-zinc-500">
          {tUI("tip.title")}
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500">{tUI("tip.hint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {presetAmounts.map(({ pct, amount }) => {
          const selected =
            pct === 0
              ? value === 0 && !customOpen
              : activePreset?.pct === pct && !customOpen;
          return (
            <button
              key={pct}
              type="button"
              onClick={() => {
                setCustomOpen(false);
                onChange(amount);
              }}
              className={cn(
                "rounded-full border px-3 py-2 text-sm font-medium transition touch-manipulation",
                selected
                  ? "border-orange-500 bg-orange-500/15 text-orange-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
              )}
            >
              {pct === 0
                ? tUI("tip.none")
                : `${pct}% · ${formatPrice(amount, currency)}`}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={cn(
            "rounded-full border px-3 py-2 text-sm font-medium transition touch-manipulation",
            customOpen || (!activePreset && value > 0)
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
            placeholder={formatPrice(amountDue * 0.1, currency)}
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
        <p className="text-sm text-zinc-400">
          {tUI("tip.selected", { amount: formatPrice(value, currency) })}
        </p>
      )}
    </div>
  );
}
