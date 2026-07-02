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
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] py-20 text-[var(--lp-ink)] md:py-28"
    >
      <LandingContainer wide>
        <AnimateInView className="max-w-[640px]">
          <LandingEyebrow inverted>{enterprise.eyebrow}</LandingEyebrow>
          <LandingHeadline inverted className="mt-3">
            {enterprise.title}
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            {enterprise.lead}
          </LandingLead>
        </AnimateInView>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {enterprise.pillars.map((pillar) => (
            <AnimateInView key={pillar.title}>
              <div className="h-full rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-bg)] p-8">
                <h3 className="text-[15px] font-medium text-white">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
                  {pillar.description}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {enterprise.caseStudies.map((study) => (
            <AnimateInView key={study.venue}>
              <article className="rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-bg)] p-8">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--qr-ember)]">
                  {study.result}
                </p>
                <h3 className="mt-3 font-display text-xl font-medium text-white">
                  {study.venue}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                  &ldquo;{study.quote}&rdquo;
                </p>
              </article>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView className="mt-12 flex flex-col items-start gap-3 sm:flex-row">
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
