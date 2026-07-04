"use client";

import {
  ClipboardCheck,
  Clock3,
  MessageSquareQuote,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { AnimateInView, StaggerInView, StaggerItem } from "@/components/landing/animate-in-view";
import { CountUpStat } from "@/components/landing/count-up-stat";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";

const SOCIAL_STAT_ICONS = [
  ClipboardCheck,
  Clock3,
  ShieldCheck,
  QrCode,
] as const;

export function LandingSocialProof() {
  const { copy } = useLandingCopy();
  const { social } = copy;

  return (
    <section
      id="social-proof"
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <div className="mx-auto max-w-[1140px] overflow-hidden rounded-lg border border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] shadow-[0_34px_90px_-70px_rgba(22,20,14,0.42)]">
          <div
            className="pointer-events-none h-1 bg-gradient-to-r from-transparent via-[var(--lp-ember)] to-transparent"
            aria-hidden
          />

          <div className="grid border-b border-[var(--lp-border-subtle)] lg:grid-cols-[0.92fr_1.08fr]">
            <AnimateInView className="relative px-8 py-12 sm:px-10 lg:px-12 lg:py-16">
              <div
                className="pointer-events-none absolute right-8 top-10 hidden size-20 rounded-full border border-[var(--lp-ember)]/15 bg-[var(--lp-ember-muted)] lg:block"
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-lg border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)] text-[var(--lp-ember)]">
                    <ShieldCheck className="size-6" strokeWidth={1.9} />
                  </span>
                  <LandingEyebrow inverted>{social.eyebrow}</LandingEyebrow>
                </div>
                <LandingHeadline inverted className="mt-5 max-w-[30rem]">
                  {social.title}
                </LandingHeadline>
              </div>
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
            {social.stats.map((stat, index) => {
              const Icon = SOCIAL_STAT_ICONS[index] ?? ShieldCheck;

              return (
                <StaggerItem key={stat.label}>
                  <div className="group relative flex min-h-[198px] flex-col justify-between overflow-hidden px-6 py-7 transition-colors hover:bg-[var(--lp-tint)]/45 sm:px-7 md:py-8">
                    <div
                      className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-[var(--lp-ember)]/0 to-transparent transition-colors group-hover:via-[var(--lp-ember)]/40"
                      aria-hidden
                    />
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex size-14 items-center justify-center rounded-lg border border-[var(--lp-ember)]/20 bg-[var(--lp-ember-muted)] text-[var(--lp-ember)] shadow-[0_18px_45px_-32px_rgba(232,93,4,0.85)]">
                        <Icon className="size-7" strokeWidth={1.85} />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-normal text-[var(--lp-subtle)]">
                        0{index + 1}
                      </span>
                    </div>
                    <div className="[&>div]:text-left [&_p:first-child]:text-[clamp(2.4rem,4.3vw,3.35rem)] [&_p:first-child]:leading-none [&_p:first-child]:text-[var(--lp-ink)] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-[9.5rem] [&_p:last-child]:text-[13px] [&_p:last-child]:font-medium [&_p:last-child]:leading-snug">
                      <CountUpStat
                        value={stat.value}
                        suffix={stat.suffix}
                        prefix={stat.prefix}
                        decimals={stat.decimals ?? 0}
                        label={stat.label}
                      />
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerInView>

          <div className="grid border-t border-[var(--lp-border-subtle)] md:grid-cols-2">
            {social.testimonials.map((item, index) => (
              <AnimateInView key={item.name}>
                <blockquote className="relative h-full px-8 py-10 transition-colors hover:bg-[var(--lp-tint)]/35 sm:px-10 lg:px-12">
                  {index > 0 && (
                    <div className="absolute inset-y-0 left-0 hidden w-px bg-[var(--lp-border-subtle)] md:block" />
                  )}
                  <span className="flex size-12 items-center justify-center rounded-lg border border-[var(--lp-ember)]/18 bg-[var(--lp-ember-muted)] text-[var(--lp-ember)]">
                    <MessageSquareQuote className="size-6" strokeWidth={1.8} />
                  </span>
                  <p className="mt-6 text-[17px] leading-relaxed text-[var(--lp-ink)]/84">
                    {item.quote}
                  </p>
                  <footer className="mt-7 border-t border-[var(--lp-border-subtle)] pt-5">
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
