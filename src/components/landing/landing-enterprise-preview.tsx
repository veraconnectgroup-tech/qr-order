"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingEnterprisePreview() {
  const { copy } = useLandingCopy();
  const { enterprise } = copy;

  return (
    <section
      id="enterprise"
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <div className="mx-auto max-w-[1140px] border-x border-[var(--lp-border-subtle)] bg-[var(--lp-surface)]">
          <div
            className="pointer-events-none h-px bg-gradient-to-r from-transparent via-[var(--lp-ember)]/35 to-transparent"
            aria-hidden
          />

          <div className="grid border-b border-[var(--lp-border-subtle)] lg:grid-cols-[1fr_1fr]">
            <AnimateInView className="px-8 py-12 sm:px-10 lg:px-12 lg:py-16">
              <LandingEyebrow inverted>{enterprise.eyebrow}</LandingEyebrow>
              <LandingHeadline inverted className="mt-4 max-w-[30rem]">
                {enterprise.title}
              </LandingHeadline>
            </AnimateInView>

            <AnimateInView
              delay={0.06}
              className="border-t border-[var(--lp-border-subtle)] px-8 py-12 sm:px-10 lg:border-l lg:border-t-0 lg:px-12 lg:py-16"
            >
              <LandingLead inverted className="max-w-[33rem]">
                {enterprise.lead}
              </LandingLead>
            </AnimateInView>
          </div>

          <div className="grid md:grid-cols-3">
            {enterprise.pillars.map((pillar, index) => (
              <AnimateInView key={pillar.title}>
                <div className="group flex h-full flex-col border-b border-[var(--lp-border-subtle)] px-8 py-9 transition-colors hover:bg-[var(--lp-tint)]/35 md:border-b-0 md:border-r md:last:border-r-0 sm:px-10 lg:px-12">
                  <span className="flex size-8 items-center justify-center rounded-full border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)] text-[12px] font-semibold tabular-nums text-[var(--lp-ember)]">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-[15px] font-semibold text-[var(--lp-ink)]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--lp-muted)]">
                    {pillar.description}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>

          <div className="grid border-t border-[var(--lp-border-subtle)] lg:grid-cols-2">
            {enterprise.caseStudies.map((study, index) => (
              <AnimateInView key={study.venue}>
                <article className="relative h-full px-8 py-10 transition-colors hover:bg-[var(--lp-tint)]/35 sm:px-10 lg:px-12">
                  {index > 0 && (
                    <div className="absolute inset-y-0 left-0 hidden w-px bg-[var(--lp-border-subtle)] lg:block" />
                  )}
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--lp-ember)]">
                    {study.result}
                  </p>
                  <h3 className="mt-4 font-display text-[1.35rem] font-semibold leading-tight text-[var(--lp-ink)]">
                    {study.venue}
                  </h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-muted)]">
                    &ldquo;{study.quote}&rdquo;
                  </p>
                </article>
              </AnimateInView>
            ))}
          </div>

          <AnimateInView className="flex flex-col items-center justify-center gap-3 border-t border-[var(--lp-border-subtle)] px-8 py-8 sm:flex-row sm:px-10">
            <Button
              size="lg"
              asChild
              className="landing-btn-primary h-11 px-6 text-[14px] font-medium"
            >
              <Link href="/enterprise">
                {enterprise.cta}
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              asChild
              className="landing-btn-secondary h-11 px-6 text-[14px] font-medium"
            >
              <Link href="/signup">{enterprise.ctaSecondary}</Link>
            </Button>
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
