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
      className="scroll-mt-24 border-t border-white/[0.06] bg-black py-16 text-white md:py-20"
    >
      <LandingContainer wide>
        <AnimateInView className="max-w-[480px]">
          <LandingHeadline inverted>{faq.title}</LandingHeadline>
          <LandingLead inverted className="mt-4">
            {faq.lead}
          </LandingLead>
        </AnimateInView>

        <div className="mt-12 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {faq.items.map((item) => (
            <AnimateInView key={item.q}>
              <details className="group py-5 md:py-6">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-zinc-100",
                    "[&::-webkit-details-marker]:hidden"
                  )}
                >
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
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
