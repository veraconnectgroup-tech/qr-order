"use client";

import { ShowcasePhone } from "@/components/landing/showcase-frame";

function DenisPanelPreview() {
  return (
    <div className="flex min-h-[440px] flex-col bg-[#0a0a0a]">
      <header className="shrink-0 border-b border-zinc-800/70 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">
          Denis
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">Table 8 · Skyline Lounge</p>
      </header>

      <div className="flex flex-1 flex-col justify-end gap-5 px-5 pb-6 pt-7">
        <div className="max-w-[88%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-3.5 py-3 ring-1 ring-zinc-800/90">
          <p className="text-[12px] leading-relaxed text-zinc-300">
            Something light before mains?
          </p>
        </div>

        <div className="max-w-[92%]">
          <div className="mb-3 flex items-center gap-2">
            <span className="showcase-denis-dots inline-flex gap-1" aria-hidden>
              <span className="size-1 rounded-full bg-zinc-500" />
              <span className="size-1 rounded-full bg-zinc-500" />
              <span className="size-1 rounded-full bg-zinc-500" />
            </span>
            <span className="text-[10px] text-zinc-600">Operational suggestion</span>
          </div>
          <div className="rounded-xl bg-zinc-950 p-3.5 ring-1 ring-zinc-800/90">
            <p className="text-[14px] font-medium tracking-[-0.01em] text-zinc-100">
              Caesar salad
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              Ready in ~12 min · pairs with your spritz · €14.50
            </p>
            <span className="mt-3.5 inline-block rounded-lg border border-[#e85d04]/50 px-3.5 py-1.5 text-[11px] font-medium text-[#e85d04]">
              Add to order
            </span>
          </div>
        </div>
      </div>
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
