"use client";

import { ChevronDown } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

export function LandingFaq() {
  const { copy } = useLandingCopy();
  const { faq } = copy;

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[520px] text-center">
          <LandingHeadline inverted>{faq.title}</LandingHeadline>
          <LandingLead inverted className="mt-4">
            {faq.lead}
          </LandingLead>
        </AnimateInView>

        <div className="mx-auto mt-14 max-w-[720px] space-y-3">
          {faq.items.map((item) => (
            <AnimateInView key={item.q}>
              <details className="group rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 shadow-[0_1px_2px_rgba(22,20,14,0.04)] transition-all duration-300 open:border-[var(--lp-ember)]/25 open:shadow-[0_8px_24px_rgba(22,20,14,0.06)] hover:border-[var(--lp-ink)]/20">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-medium text-[var(--lp-ink)]",
                    "[&::-webkit-details-marker]:hidden"
                  )}
                >
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-[var(--lp-subtle)] transition group-open:rotate-180" />
                </summary>
                <p className="border-t border-[var(--lp-border-subtle)] pb-5 pt-4 text-[15px] leading-relaxed text-[var(--lp-muted)]">
                  {item.a}
                </p>
              </details>
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
