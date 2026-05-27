"use client";

import { Check, Plus } from "lucide-react";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { QrCard } from "@/components/design-system/qr-card";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

const DEMO_RECOMMENDATIONS = [
  {
    name: "Caesar Salad",
    price: 12.5,
    reason: "Allergen-safe for your selection",
  },
  {
    name: "Grilled Sea Bass",
    price: 24.0,
    reason: "Light option · 18 min prep",
  },
] as const;

function DenisPanelPreview() {
  return (
    <div className="flex h-full min-h-[420px] flex-col bg-[var(--qr-void,#0a0908)]">
      <div className="flex items-center justify-between border-b border-[var(--qr-elevated,#1c1917)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <DenisTableMark size={24} state="idle" />
          <span className="text-[11px] font-semibold text-[var(--qr-ivory,#f5f0eb)]">
            Denis
          </span>
        </div>
        <span className="rounded-full border border-[var(--qr-ember,#e85d04)]/30 bg-[var(--qr-ember-muted,rgba(232,93,4,0.12))] px-2 py-0.5 text-[10px] font-medium text-[var(--qr-ivory,#f5f0eb)]">
          2 · €36.50
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden p-3">
        <article className="rounded-xl border border-[var(--qr-elevated,#1c1917)] border-l-2 border-l-[var(--qr-ember,#e85d04)] bg-[var(--qr-elevated,#1c1917)] px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <DenisTableMark size={24} state="idle" className="size-3" />
            <span className="text-[9px] font-medium text-[var(--qr-muted,#9c958c)]">
              Denis
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--qr-ivory,#f5f0eb)]">
            Based on your preferences, here are two options that fit your table.
          </p>
        </article>

        <div className="space-y-2">
          {DEMO_RECOMMENDATIONS.map((item) => (
            <QrCard
              key={item.name}
              padding="sm"
              className="border-[var(--qr-elevated,#1c1917)] bg-[var(--qr-surface,#141210)]"
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[var(--qr-ivory,#f5f0eb)]">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-[var(--qr-muted,#9c958c)]">
                    {item.reason}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--qr-ember,#e85d04)]">
                    {formatPrice(item.price, "EUR")}
                  </p>
                </div>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--qr-ember,#e85d04)] text-white">
                  <Plus className="size-3.5" />
                </span>
              </div>
            </QrCard>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-xl border border-[var(--qr-elevated,#1c1917)] bg-[var(--qr-surface,#141210)] px-3 py-2 text-[11px] text-[var(--qr-ivory,#f5f0eb)]">
            Add the salad and a still water
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--qr-elevated,#1c1917)] px-3 py-2">
        <div className="flex items-center gap-2 rounded-full border border-[var(--qr-elevated,#1c1917)] bg-[var(--qr-surface,#141210)] px-3 py-2">
          <span className="flex-1 text-[10px] text-[var(--qr-muted,#9c958c)]">
            Ask Denis…
          </span>
          <span className="flex size-6 items-center justify-center rounded-full bg-[var(--qr-ember,#e85d04)]">
            <Check className="size-3 text-white" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function AiConciergeShowcase({ hideLabel = false }: { hideLabel?: boolean }) {
  return (
    <ShowcasePhone
      label="Guest phone — Denis panel"
      shortLabel="Guest — Denis"
      hideLabel={hideLabel}
    >
      <DenisPanelPreview />
    </ShowcasePhone>
  );
}
