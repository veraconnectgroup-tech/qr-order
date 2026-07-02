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
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingEyebrow inverted>{social.eyebrow}</LandingEyebrow>
          <LandingHeadline inverted className="mt-3">
            {social.title}
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            {social.lead}
          </LandingLead>
        </AnimateInView>

        <StaggerInView className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
          {social.stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <CountUpStat
                value={stat.value}
                suffix={stat.suffix}
                prefix={stat.prefix}
                decimals={stat.decimals ?? 0}
                label={stat.label}
              />
            </StaggerItem>
          ))}
        </StaggerInView>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {social.testimonials.map((item) => (
            <AnimateInView key={item.name}>
              <blockquote className="h-full rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)]/60 p-8">
                <p className="text-[16px] leading-relaxed text-zinc-300">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <footer className="mt-6 border-t border-white/[0.06] pt-4">
                  <p className="text-[14px] font-medium text-white">{item.name}</p>
                  <p className="mt-1 text-[13px] text-zinc-500">{item.role}</p>
                </footer>
              </blockquote>
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
