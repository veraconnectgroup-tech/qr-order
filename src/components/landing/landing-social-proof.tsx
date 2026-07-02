"use client";

import { AnimateInView, StaggerInView, StaggerItem } from "@/components/landing/animate-in-view";
import { CountUpStat } from "@/components/landing/count-up-stat";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";

export function LandingSocialProof() {
  const { copy } = useLandingCopy();
  const { social } = copy;

  return (
    <section
      id="social-proof"
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-tint)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingEyebrow inverted>{social.eyebrow}</LandingEyebrow>
          <LandingHeadline inverted className="mt-3">
            {social.title}
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            {social.lead}
          </LandingLead>
        </AnimateInView>

        <StaggerInView className="mt-14 overflow-hidden rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] shadow-[0_1px_2px_rgba(22,20,14,0.04)]">
          <div className="grid grid-cols-2 divide-x-0 divide-y divide-[var(--lp-border-subtle)] md:grid-cols-4 md:divide-x md:divide-y-0">
            {social.stats.map((stat) => (
              <StaggerItem key={stat.label}>
                <div className="px-6 py-8 md:py-10">
                  <CountUpStat
                    value={stat.value}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    decimals={stat.decimals ?? 0}
                    label={stat.label}
                  />
                </div>
              </StaggerItem>
            ))}
          </div>
        </StaggerInView>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {social.testimonials.map((item) => (
            <AnimateInView key={item.name}>
              <blockquote className="relative h-full overflow-hidden rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] p-8 shadow-[0_1px_2px_rgba(22,20,14,0.04)]">
                <span
                  className="pointer-events-none absolute -left-1 -top-3 font-display text-[5rem] leading-none text-[var(--lp-ember)]/15"
                  aria-hidden
                >
                  &ldquo;
                </span>
                <p className="relative text-[16px] leading-relaxed text-[var(--lp-ink)]/80">
                  {item.quote}
                </p>
                <footer className="mt-6 border-t border-[var(--lp-border-subtle)] pt-4">
                  <p className="text-[14px] font-medium text-[var(--lp-ink)]">{item.name}</p>
                  <p className="mt-1 text-[13px] text-[var(--lp-subtle)]">{item.role}</p>
                </footer>
              </blockquote>
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
