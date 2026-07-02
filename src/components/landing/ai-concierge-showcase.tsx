"use client";

import { Check, CreditCard, MessageCircle, Sparkles } from "lucide-react";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

const RECOMMENDATIONS = [
  {
    name: "Caesar Salad",
    price: 12.5,
    reason: "Safe with current allergy notes",
  },
  {
    name: "Grilled Sea Bass",
    price: 24,
    reason: "Kitchen says 18 min prep",
  },
] as const;

function RecommendationRow({
  name,
  price,
  reason,
}: {
  name: string;
  price: number;
  reason: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#e7ebf0] bg-white p-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#eef1f5] text-[12px] font-bold text-[#596273]">
        {name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-[#1f2328]">
          {name}
        </p>
        <p className="truncate text-[10px] text-[#6b7280]">{reason}</p>
      </div>
      <p className="font-mono text-[11px] font-semibold text-[#1f2328]">
        {formatPrice(price, "EUR")}
      </p>
    </div>
  );
}

function DenisPanelPreview() {
  return (
    <div className="flex min-h-[430px] flex-col bg-[#fbfcfd]">
      <header className="flex items-center gap-2 border-b border-[#e7ebf0] bg-white px-3 py-3">
        <DenisTableMark size={24} state="idle" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight text-[#1f2328]">
            Denis
          </p>
          <p className="text-[10px] text-[#6b7280]">Table 8 assistant</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Live
        </span>
      </header>

      <main className="flex-1 space-y-3 px-3 py-3">
        <div className="rounded-xl border border-[#e7ebf0] bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-3.5 text-[#e85d04]" />
            <p className="text-[10px] font-semibold uppercase tracking-normal text-[#6b7280]">
              Denis recommendation
            </p>
          </div>
          <p className="text-[12px] leading-relaxed text-[#1f2328]">
            The table is calm. Kitchen has capacity. Suggest one light main and
            keep the drinks flowing.
          </p>
          <div className="mt-3 space-y-2">
            {RECOMMENDATIONS.map((item) => (
              <RecommendationRow key={item.name} {...item} />
            ))}
          </div>
        </div>

        <div className="ml-8 rounded-xl rounded-br-sm bg-[#1f2328] p-3 text-white">
          <p className="text-[12px] leading-relaxed">
            Add the salad and a still water.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-emerald-700" />
            <p className="text-[12px] font-semibold text-emerald-900">
              Added to cart
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
            Denis will watch kitchen load before suggesting dessert.
          </p>
        </div>
      </main>

      <footer className="border-t border-[#e7ebf0] bg-white px-3 py-3">
        <div className="mb-2 grid grid-cols-2 gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#eef1f5] px-2 py-1 font-semibold text-[#596273]">
            <CreditCard className="size-3" />
            Stripe ready
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 font-semibold text-orange-700">
            <MessageCircle className="size-3" />
            Guest truth
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e7ebf0] bg-[#fbfcfd] px-3 py-2">
          <span className="flex-1 text-[10px] text-[#6b7280]">
            Ask Denis...
          </span>
          <span className="flex size-6 items-center justify-center rounded-full bg-[#1f2328]">
            <Check className="size-3 text-white" />
          </span>
        </div>
      </footer>
    </div>
  );
}

export function AiConciergeShowcase({
  hideLabel = false,
}: {
  hideLabel?: boolean;
}) {
  return (
    <ShowcasePhone
      label="Guest phone - Denis panel"
      shortLabel="Guest - Denis"
      hideLabel={hideLabel}
    >
      <DenisPanelPreview />
    </ShowcasePhone>
  );
}
