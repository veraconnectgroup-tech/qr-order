"use client";

import { ShowcasePhone } from "@/components/landing/showcase-frame";

/** Operational concierge intelligence — not chatbot bubbles. */
function DenisPanelPreview() {
  return (
    <div className="flex min-h-[480px] flex-col bg-[var(--lp-bg)]">
      <div className="flex-1" aria-hidden />
      <div className="px-6 pb-10 pt-8">
        <p className="landing-meta">Table 8 · suggestion</p>
        <p className="mt-6 text-[17px] font-medium leading-snug tracking-[-0.02em] text-[var(--lp-ink)]">
          Caesar salad before mains
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--lp-muted)]">
          ~12 min · complements your spritz order
        </p>
        <p className="mt-8 text-[12px] font-medium text-[var(--lp-ember)]">
          Add to order
        </p>
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
      className={presentation === "float" ? "max-w-[260px] sm:max-w-[280px]" : undefined}
    >
      <DenisPanelPreview />
    </ShowcasePhone>
  );
}
