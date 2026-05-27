"use client";

import { ShowcasePhone } from "@/components/landing/showcase-frame";

function DenisPanelPreview() {
  return (
    <div className="flex min-h-[420px] flex-col bg-[#09090b]">
      <header className="shrink-0 border-b border-zinc-800/80 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">
          Denis
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Table 8 · Skyline Lounge</p>
      </header>

      <div className="flex flex-1 flex-col justify-end gap-4 px-4 pb-5 pt-6">
        <div className="max-w-[88%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2.5 ring-1 ring-zinc-800">
          <p className="text-[12px] leading-relaxed text-zinc-300">
            Something light before mains?
          </p>
        </div>

        <div className="max-w-[92%]">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-600">
            Recommended
          </p>
          <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-800/90">
            <p className="text-[14px] font-medium text-zinc-100">Caesar salad</p>
            <p className="mt-1 text-[11px] text-zinc-500">Ready in ~12 min · €14.50</p>
            <span className="mt-3 inline-block rounded-lg border border-[#e85d04]/50 px-3 py-1.5 text-[11px] font-medium text-[#e85d04]">
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
