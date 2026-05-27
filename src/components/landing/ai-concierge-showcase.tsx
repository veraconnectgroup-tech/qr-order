"use client";

import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

function DenisPanelPreview() {
  return (
    <div className="flex min-h-[420px] flex-col bg-[#09090b] px-6 py-8">
      <div className="mb-12 flex items-center gap-2">
        <DenisTableMark size={24} state="idle" className="size-3.5 opacity-40" />
        <span className="text-[12px] text-zinc-600">Denis</span>
      </div>

      <p className="max-w-[20ch] text-[16px] leading-[1.55] tracking-[-0.02em] text-zinc-300">
        Caesar salad — allergen-safe, twelve minutes.
      </p>

      <div className="mt-12 flex items-baseline justify-between gap-6">
        <span className="text-[14px] text-zinc-400">Caesar Salad</span>
        <span className="font-mono text-[13px] tabular-nums text-zinc-500">
          {formatPrice(12.5, "EUR")}
        </span>
      </div>

      <p className="mt-auto pt-16 text-[11px] text-zinc-800">Table 8</p>
    </div>
  );
}

export function AiConciergeShowcase({
  hideLabel = false,
  presentation = "default",
}: {
  hideLabel?: boolean;
  presentation?: "default" | "float";
}) {
  return (
    <ShowcasePhone
      label="Guest — Denis"
      shortLabel="Guest"
      hideLabel={hideLabel}
      presentation={presentation}
      className={presentation === "float" ? "max-w-none" : undefined}
    >
      <DenisPanelPreview />
    </ShowcasePhone>
  );
}
