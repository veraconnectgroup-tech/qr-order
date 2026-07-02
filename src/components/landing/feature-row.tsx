"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

export function FeatureRow({
  id,
  eyebrow,
  title,
  lead,
  bullets,
  visual,
  reverse = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <div
          className={cn(
            "grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20",
            reverse && "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1"
          )}
        >
          <AnimateInView className="max-w-md">
            <LandingEyebrow inverted>{eyebrow}</LandingEyebrow>
            <LandingHeadline inverted className="mt-3">
              {title}
            </LandingHeadline>
            <LandingLead inverted className="mt-4">
              {lead}
            </LandingLead>
            <ul className="mt-8 space-y-3">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 text-[15px] leading-relaxed text-[var(--lp-muted)]"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--qr-ember)]"
                    aria-hidden
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          </AnimateInView>

          <AnimateInView delay={0.08} className="min-w-0">
            {visual}
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
