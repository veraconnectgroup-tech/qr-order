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
      className="scroll-mt-24 border-t border-white/[0.06] bg-white/[0.015] py-20 text-white md:py-28"
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
              <div className="h-full rounded-2xl border border-white/[0.08] bg-black/40 p-8">
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
              <article className="rounded-2xl border border-white/[0.08] bg-black/50 p-8">
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
            className="h-12 rounded-full bg-[var(--qr-ember)] px-8 text-sm font-semibold text-white hover:bg-[var(--qr-ember-hover)]"
          >
            <Link href="/enterprise">
              {enterprise.cta}
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 rounded-full border-white/[0.12] bg-transparent px-8 text-sm text-zinc-200 hover:bg-white/[0.04]"
          >
            <Link href="/signup">{enterprise.ctaSecondary}</Link>
          </Button>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
