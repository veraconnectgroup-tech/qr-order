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
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingEyebrow inverted>{enterprise.eyebrow}</LandingEyebrow>
          <LandingHeadline inverted className="mt-3">
            {enterprise.title}
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            {enterprise.lead}
          </LandingLead>
        </AnimateInView>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {enterprise.pillars.map((pillar, index) => (
            <AnimateInView key={pillar.title}>
              <div className="flex h-full flex-col rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] p-8 shadow-[0_1px_2px_rgba(22,20,14,0.04)]">
                <span className="flex size-9 items-center justify-center rounded-full bg-[var(--lp-ember-muted)] text-[13px] font-semibold tabular-nums text-[var(--lp-ember)]">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-[15px] font-medium text-[var(--lp-ink)]">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--lp-muted)]">
                  {pillar.description}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {enterprise.caseStudies.map((study) => (
            <AnimateInView key={study.venue}>
              <article className="rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] p-8 shadow-[0_1px_2px_rgba(22,20,14,0.04)]">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--lp-ember)]">
                  {study.result}
                </p>
                <h3 className="mt-3 font-display text-xl font-medium text-[var(--lp-ink)]">
                  {study.venue}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-muted)]">
                  &ldquo;{study.quote}&rdquo;
                </p>
              </article>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
      </LandingContainer>
    </section>
  );
}
