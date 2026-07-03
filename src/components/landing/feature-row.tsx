"use client";

import Image from "next/image";
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
  tone = "default",
  index,
  scene,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
  tone?: "default" | "surface" | "tint";
  /** Optional 1-based chapter number rendered as a premium chip. */
  index?: number;
  /**
   * Watercolor scene under the whole section (hero language).
   * Mockup floats on the paint; the text column gets a stronger wash.
   */
  scene?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-24 overflow-hidden border-t border-[var(--lp-border-subtle)] py-20 text-[var(--lp-ink)] md:py-28",
        !scene && tone === "surface" && "bg-[var(--lp-surface)]",
        !scene && tone === "tint" && "bg-[var(--lp-tint)]",
        !scene && tone === "default" && "bg-[var(--lp-bg)]",
        scene && "bg-[var(--lp-bg)]"
      )}
    >
      {scene && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <Image
            src={scene}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          {/* Stronger wash over the text column, paint stays visible under the mockup */}
          <div
            className={cn(
              "absolute inset-0",
              reverse
                ? "landing-feature-scene-wash-right"
                : "landing-feature-scene-wash-left"
            )}
          />
        </div>
      )}

      {/* Ember hairline at the section seam */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-[240px] bg-gradient-to-r from-transparent via-[var(--lp-ember)]/35 to-transparent"
        aria-hidden
      />

      <LandingContainer wide className="relative">
        <div
          className={cn(
            "grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20",
            reverse && "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1"
          )}
        >
          <AnimateInView className="max-w-md">
            <div className="flex items-center gap-3">
              {index != null && (
                <span className="flex size-7 items-center justify-center rounded-full border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)] text-[12px] font-semibold tabular-nums text-[var(--lp-ember)]">
                  {String(index).padStart(2, "0")}
                </span>
              )}
              <LandingEyebrow inverted>{eyebrow}</LandingEyebrow>
            </div>
            <LandingHeadline inverted className="mt-4">
              {title}
            </LandingHeadline>
            <LandingLead inverted className="mt-4">
              {lead}
            </LandingLead>
            <ul className="mt-8 space-y-3">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="group flex gap-3 text-[15px] leading-relaxed text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--lp-ember)] transition-transform group-hover:scale-125"
                    aria-hidden
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          </AnimateInView>

          <AnimateInView delay={0.08} className="relative min-w-0">
            {!scene && (
              <div
                className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(ellipse_65%_55%_at_50%_50%,rgba(232,93,4,0.055),transparent_70%)]"
                aria-hidden
              />
            )}
            <div className="relative">{visual}</div>
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
