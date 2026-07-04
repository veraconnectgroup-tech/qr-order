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
        <div className="mx-auto max-w-[1140px]">
          <div className="grid border-y border-[var(--lp-border-subtle)] lg:grid-cols-[0.92fr_1.08fr]">
            <AnimateInView className="py-12 pr-8 sm:py-14 lg:pr-14">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-[var(--lp-ember)]" aria-hidden />
                <LandingEyebrow inverted>{social.eyebrow}</LandingEyebrow>
              </div>
              <LandingHeadline inverted className="mt-5 max-w-[29rem]">
                {social.title}
              </LandingHeadline>
            </AnimateInView>

            <AnimateInView
              delay={0.06}
              className="border-t border-[var(--lp-border-subtle)] py-12 text-left sm:py-14 lg:border-l lg:border-t-0 lg:pl-14"
            >
              <LandingLead inverted className="max-w-[34rem]">
                {social.lead}
              </LandingLead>
            </AnimateInView>
          </div>

          <StaggerInView className="grid border-b border-[var(--lp-border-subtle)] md:grid-cols-4">
            {social.stats.map((stat, index) => (
              <StaggerItem key={stat.label}>
                <div className="group relative min-h-[160px] border-t border-[var(--lp-border-subtle)] px-0 py-8 md:border-r md:last:border-r-0 md:px-7 lg:px-9">
                  <div
                    className="pointer-events-none absolute left-0 top-0 h-px w-10 bg-[var(--lp-ember)] opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                  <div className="mb-7 flex items-center justify-between">
                    <span className="size-1.5 rounded-full bg-[var(--lp-ember)]" aria-hidden />
                    <span className="text-[11px] font-semibold text-[var(--lp-subtle)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="[&>div]:text-left [&_p:first-child]:text-[clamp(2.35rem,4vw,3.25rem)] [&_p:first-child]:leading-none [&_p:first-child]:text-[var(--lp-ink)] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-[10rem] [&_p:last-child]:text-[13px] [&_p:last-child]:font-medium [&_p:last-child]:leading-snug">
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
            ))}
          </StaggerInView>

          <div className="grid gap-8 pt-12 md:grid-cols-2">
            {social.testimonials.map((item) => (
              <AnimateInView key={item.name}>
                <blockquote className="h-full border-l border-[var(--lp-ember)]/45 pl-6">
                  <p className="text-[16px] leading-relaxed text-[var(--lp-ink)]/82">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <footer className="mt-6">
                    <p className="text-[14px] font-semibold text-[var(--lp-ink)]">{item.name}</p>
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
