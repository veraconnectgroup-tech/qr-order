"use client";

import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

const ITEMS = [
  { name: "Caesar Salad", price: 12.5, reason: "Allergen-safe" },
  { name: "Grilled Sea Bass", price: 24.0, reason: "Light · 18 min" },
] as const;

function DenisPanelPreview() {
  return (
    <div className="flex min-h-[420px] flex-col bg-[#0a0908] px-4 py-5">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DenisTableMark size={24} state="idle" className="size-4 opacity-70" />
          <span className="text-sm text-[#f5f0eb]">Denis</span>
        </div>
        <span className="text-xs tabular-nums text-[#9c958c]">2 · {formatPrice(36.5, "EUR")}</span>
      </div>

      <div className="space-y-6 text-sm leading-[1.65]">
        <p className="text-[#f5f0eb]">
          Based on your preferences, here are two options that fit your table.
        </p>

        <div className="space-y-4">
          {ITEMS.map((item) => (
            <div key={item.name} className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-[#f5f0eb]">{item.name}</p>
                <p className="mt-1 text-[#9c958c]">{item.reason}</p>
              </div>
              <span className="shrink-0 tabular-nums text-[#f5f0eb]">
                {formatPrice(item.price, "EUR")}
              </span>
            </div>
          ))}
        </div>

        <p className="text-right text-[#9c958c]">Add the salad and a still water</p>
      </div>

      <div className="mt-auto pt-8">
        <p className="border-b border-[#1c1917] pb-3 text-[#9c958c]">Ask Denis…</p>
      </div>
    </div>
  );
}

export function AiConciergeShowcase({ hideLabel = false }: { hideLabel?: boolean }) {
  return (
    <ShowcasePhone label="Guest — Denis" shortLabel="Guest" hideLabel={hideLabel}>
      <DenisPanelPreview />
    </ShowcasePhone>
  );
}
