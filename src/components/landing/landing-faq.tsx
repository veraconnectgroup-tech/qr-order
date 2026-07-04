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
        <div className="mx-auto grid max-w-[1140px] border-x border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] lg:grid-cols-[0.86fr_1.14fr]">
          <AnimateInView className="border-b border-[var(--lp-border-subtle)] px-8 py-12 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-16">
            <LandingHeadline inverted>{faq.title}</LandingHeadline>
            <LandingLead inverted className="mt-4 max-w-[28rem]">
              {faq.lead}
            </LandingLead>
          </AnimateInView>

          <div className="divide-y divide-[var(--lp-border-subtle)]">
            {faq.items.map((item) => (
              <AnimateInView key={item.q}>
                <details className="group px-8 transition-colors open:bg-[var(--lp-tint)]/35 hover:bg-[var(--lp-tint)]/28 sm:px-10 lg:px-12">
                  <summary
                    className={cn(
                      "flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-[15px] font-semibold text-[var(--lp-ink)]",
                      "[&::-webkit-details-marker]:hidden"
                    )}
                  >
                    {item.q}
                    <ChevronDown className="size-4 shrink-0 text-[var(--lp-subtle)] transition group-open:rotate-180" />
                  </summary>
                  <p className="max-w-[42rem] pb-7 text-[15px] leading-relaxed text-[var(--lp-muted)]">
                    {item.a}
                  </p>
                </details>
              </AnimateInView>
            ))}
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
