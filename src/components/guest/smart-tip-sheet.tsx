"use client";

import { readApiErrorMessage } from "@/lib/api-error-client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { formatPrice } from "@/lib/format";
import type { SmartTipOffer } from "@/lib/denis/loop/view-types";
import { cn } from "@/lib/utils";

export function SmartTipSheet({
  offer,
  currency,
  sessionToken,
  onSubmitted,
  onDismiss,
}: {
  offer: SmartTipOffer;
  currency: string;
  sessionToken: string;
  onSubmitted?: () => void;
  onDismiss?: () => void;
}) {
  const { tUI } = useAppLocale();
  const [selectedIndex, setSelectedIndex] = useState(offer.defaultIndex);
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customAmount, setCustomAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const prominent = offer.showProminent;

  const selectedAmount = useMemo(() => {
    if (customAmount != null) return customAmount;
    return offer.presetAmounts[selectedIndex] ?? 0;
  }, [customAmount, offer.presetAmounts, selectedIndex]);

  const selectedPercent = useMemo(() => {
    if (customAmount != null && offer.orderTotal > 0) {
      return Math.round((customAmount / offer.orderTotal) * 100);
    }
    return offer.presets[selectedIndex] ?? null;
  }, [customAmount, offer.orderTotal, offer.presets, selectedIndex]);

  if (dismissed) return null;

  async function submitTip(amount: number) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/commerce/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: offer.orderId,
          sessionToken,
          tipAmount: amount,
          tipPercent: selectedPercent,
          presetIndex: customAmount != null ? null : selectedIndex,
          smartDefaultUsed:
            customAmount == null && selectedIndex === offer.defaultIndex,
          denisPromptShown: Boolean(offer.denisMessage),
          experienceScore: offer.experienceScore,
          marketRegion: offer.marketRegion,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(readApiErrorMessage(json, res.status, tUI("error.generic")));
      }
      toast.success(tUI("tip.selected", { amount: formatPrice(amount, currency) }));
      onSubmitted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tUI("error.generic")
      );
    } finally {
      setSaving(false);
    }
  }

  function applyCustom() {
    const parsed = Number.parseFloat(customInput.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) return;
    setCustomAmount(parsed);
    setCustomOpen(false);
  }

  return (
    <div
      className={cn(
        "border-t border-[var(--qr-elevated)]/80 px-3 py-3",
        !prominent && "opacity-90"
      )}
    >
      <p className="text-xs font-semibold text-[var(--qr-ivory)]">
        {prominent ? "💛 " : ""}
        {tUI(offer.titleKey as "tip.title")}
      </p>
      {offer.denisMessage ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--qr-muted)]">
          {offer.denisMessage}
        </p>
      ) : offer.personalMessage ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--qr-muted)]">
          {offer.personalMessage}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-[var(--qr-muted)]">
        {tUI("bill.amountDue")}: {formatPrice(offer.orderTotal, currency)}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {offer.presets.map((percent, index) => {
          const amount = offer.presetAmounts[index] ?? 0;
          const active =
            customAmount == null && !customOpen && selectedIndex === index;
          return (
            <button
              key={percent}
              type="button"
              disabled={saving}
              onClick={() => {
                setCustomAmount(null);
                setCustomOpen(false);
                setSelectedIndex(index);
              }}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-[10px] font-semibold tabular-nums",
                active
                  ? "bg-[var(--qr-ember)]/25 text-[var(--qr-ember)] ring-1 ring-[var(--qr-ember)]/40"
                  : "border border-[var(--qr-elevated)] text-[var(--qr-muted)]"
              )}
            >
              {index === offer.defaultIndex && active ? "✨ " : ""}
              {formatPrice(amount, currency)} ({percent}%)
            </button>
          );
        })}
        <button
          type="button"
          disabled={saving}
          onClick={() => setCustomOpen(true)}
          className={cn(
            "rounded-full border px-2.5 py-1.5 text-[10px] font-semibold",
            customOpen || customAmount != null
              ? "border-[var(--qr-ember)]/40 text-[var(--qr-ember)]"
              : "border-[var(--qr-elevated)] text-[var(--qr-muted)]"
          )}
        >
          {tUI("tip.custom")}
        </button>
      </div>

      {customOpen ? (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            placeholder={formatPrice(offer.orderTotal * 0.1, currency)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-2.5 py-1.5 text-sm text-[var(--qr-ivory)] outline-none focus:border-[var(--qr-ember)]"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-lg bg-[var(--qr-ember)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--qr-ember)]"
          >
            {tUI("common.confirm")}
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={saving || selectedAmount <= 0}
          onClick={() => void submitTip(selectedAmount)}
          className="rounded-full bg-[var(--qr-ember)]/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-ember)] disabled:opacity-50"
        >
          {saving ? "…" : tUI("common.confirm")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="rounded-full border border-[var(--qr-elevated)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-muted)]"
        >
          {tUI("tip.none")}
        </button>
      </div>
    </div>
  );
}
