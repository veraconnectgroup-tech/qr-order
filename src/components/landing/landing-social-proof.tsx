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
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <div className="mx-auto max-w-[1140px] border-x border-[var(--lp-border-subtle)] bg-[var(--lp-surface)]">
          <div
            className="pointer-events-none h-px bg-gradient-to-r from-transparent via-[var(--lp-ember)]/35 to-transparent"
            aria-hidden
          />

          <div className="grid border-b border-[var(--lp-border-subtle)] lg:grid-cols-[0.95fr_1.05fr]">
            <AnimateInView className="px-8 py-12 sm:px-10 lg:px-12 lg:py-16">
              <LandingEyebrow inverted>{social.eyebrow}</LandingEyebrow>
              <LandingHeadline inverted className="mt-4 max-w-[29rem]">
                {social.title}
              </LandingHeadline>
            </AnimateInView>

            <AnimateInView
              delay={0.06}
              className="border-t border-[var(--lp-border-subtle)] px-8 py-12 sm:px-10 lg:border-l lg:border-t-0 lg:px-12 lg:py-16"
            >
              <LandingLead inverted className="max-w-[34rem]">
                {social.lead}
              </LandingLead>
            </AnimateInView>
          </div>

          <StaggerInView className="grid grid-cols-2 divide-x-0 divide-y divide-[var(--lp-border-subtle)] md:grid-cols-4 md:divide-x md:divide-y-0">
            {social.stats.map((stat) => (
              <StaggerItem key={stat.label}>
                <div className="min-h-[154px] px-6 py-8 transition-colors hover:bg-[var(--lp-tint)]/45 md:py-10">
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
          </StaggerInView>

          <div className="grid border-t border-[var(--lp-border-subtle)] md:grid-cols-2">
            {social.testimonials.map((item, index) => (
              <AnimateInView key={item.name}>
                <blockquote className="relative h-full px-8 py-10 transition-colors hover:bg-[var(--lp-tint)]/35 sm:px-10 lg:px-12">
                  {index > 0 && (
                    <div className="absolute inset-y-0 left-0 hidden w-px bg-[var(--lp-border-subtle)] md:block" />
                  )}
                  <span
                    className="font-display text-[3.25rem] leading-none text-[var(--lp-ember)]/18"
                    aria-hidden
                  >
                    &ldquo;
                  </span>
                  <p className="mt-2 text-[16px] leading-relaxed text-[var(--lp-ink)]/82">
                    {item.quote}
                  </p>
                  <footer className="mt-7 border-t border-[var(--lp-border-subtle)] pt-4">
                    <p className="text-[14px] font-medium text-[var(--lp-ink)]">{item.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--lp-subtle)]">{item.role}</p>
                  </footer>
                </blockquote>
              </AnimateInView>
            ))}
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
