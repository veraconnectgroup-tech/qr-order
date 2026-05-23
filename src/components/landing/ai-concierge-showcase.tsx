"use client";

import { ShowcasePhone } from "@/components/landing/showcase-frame";

function AiConciergePreview() {
  return (
    <div className="flex h-full flex-col bg-zinc-950 p-3 pt-8">
      <div className="mb-3 text-center">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          AI Konobar
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 pb-4">
        <div className="rounded-2xl rounded-bl-md border border-orange-500/25 bg-orange-500/10 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-orange-100/90">
            <span className="mr-1">🤖</span>
            Based on your preferences…
          </p>
        </div>
        <div className="ml-2 space-y-2 border-l border-zinc-800 pl-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-100">
              <span className="mr-1">🍷</span>
              Aperol Spritz
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Matches your mood</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-100">
              <span className="mr-1">🥗</span>
              Caesar Salad
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Allergen-free</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiConciergeShowcase({ hideLabel = false }: { hideLabel?: boolean }) {
  return (
    <ShowcasePhone
      label="Guest phone — AI concierge"
      shortLabel="Guest — AI"
      hideLabel={hideLabel}
    >
      <AiConciergePreview />
    </ShowcasePhone>
  );
}
