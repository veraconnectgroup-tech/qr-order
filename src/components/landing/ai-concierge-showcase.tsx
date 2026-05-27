"use client";

import { ShowcasePhone } from "@/components/landing/showcase-frame";

function DenisPanelPreview() {
  return (
    <div className="flex min-h-[380px] flex-col justify-end bg-[#09090b] px-7 pb-12 pt-20">
      <p className="max-w-[16ch] text-[15px] leading-[1.65] tracking-[-0.02em] text-zinc-500">
        Caesar salad. Twelve minutes.
      </p>
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
