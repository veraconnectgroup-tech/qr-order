"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingContainer } from "@/components/landing/landing-primitives";

/**
 * "03 Staff coordination" — founder pointed at retell's "Proven Impact,
 * Real Conversations" section as the reference and asked for a premium
 * feel, not a plain photo dropped into the standard FeatureRow grid.
 * Bypasses FeatureRow entirely for this one row: retell's actual
 * pattern is one large tinted, rounded, padded card holding the whole
 * row (copy + photo) with real shadow depth, not a full-bleed section
 * tint. No fabricated customer quote/name here on purpose — this repo
 * doesn't have a real testimonial to attribute yet, so this borrows
 * retell's card weight/typography/photo treatment, not its specific
 * "customer quote" content.
 */
export function StaffCoordinationSection({
  id,
  eyebrow,
  title,
  lead,
  bullets,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
}) {
  return (
    <section
      id={id}
      className="relative scroll-mt-24 overflow-hidden border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 md:py-28"
    >
      <LandingContainer wide>
        <AnimateInView>
          <div className="overflow-hidden rounded-[2rem] bg-[var(--lp-tint)] p-8 shadow-[0_40px_100px_-40px_rgba(22,20,14,0.35)] sm:p-12 lg:p-16">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-md">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)] text-[12px] font-semibold tabular-nums text-[var(--lp-ember)]">
                    03
                  </span>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
                    {eyebrow}
                  </p>
                </div>
                <p className="landing-serif-accent mt-6 text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.2] text-[var(--lp-ink)]">
                  &ldquo;{title}&rdquo;
                </p>
                <p className="mt-5 text-[16px] leading-[1.75] tracking-[-0.01em] text-[var(--lp-muted)]">
                  {lead}
                </p>
                <ul className="mt-8 space-y-3">
                  {bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex gap-3 text-[15px] leading-relaxed text-[var(--lp-muted)]"
                    >
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--lp-ember)]"
                        aria-hidden
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative mx-auto w-full max-w-[420px] pt-8">
                {/* Floating "real product" chip, not a generic decoration —
                    the exact same live-shift exchange already shown in
                    the hero mockup (Marko asks Denis about table 8),
                    reused here instead of inventing new copy, so the
                    photo reads as "this is what staff actually do,"
                    not just a stock lifestyle shot. Negative bottom
                    margin pulls the photo up so the chip overlaps its
                    top edge for real layered depth. */}
                <div className="relative z-10 mx-4 -mb-8 rounded-2xl border border-[var(--lp-border)] bg-white p-4 shadow-[0_20px_50px_-20px_rgba(22,20,14,0.4)]">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#4c7cf0] text-[11px] font-semibold text-white">
                      M
                    </span>
                    <p className="text-[13px] leading-snug text-[var(--lp-ink)]">
                      <span className="rounded bg-[#eef1f5] px-1.5 py-0.5 text-[11px] font-bold text-[#596273]">
                        @Denis
                      </span>{" "}
                      what is happening with table 8?
                    </p>
                  </div>
                  <div className="mt-3 flex items-start gap-2 border-t border-[var(--lp-border-subtle)] pt-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--lp-ink)] text-[11px] font-semibold text-white">
                      D
                    </span>
                    <p className="text-[13px] leading-snug text-[var(--lp-muted)]">
                      Table 8: drinks ready 4 min. Kitchen in prep. Marko —
                      pick up drinks now.
                    </p>
                  </div>
                </div>

                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-[0_36px_90px_-28px_rgba(22,20,14,0.5)]">
                  <Image
                    src="/landing/staff-pos.jpg"
                    alt="Waiter confirming an order at the POS terminal"
                    fill
                    sizes="(min-width: 1024px) 420px, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                  <div className="absolute bottom-5 left-5 flex items-center gap-2.5 rounded-full bg-white/95 py-2 pl-2 pr-4 text-[13px] font-semibold text-[var(--lp-ink)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur">
                    <span className="flex size-8 items-center justify-center rounded-full bg-[var(--lp-ink)] text-white">
                      <Play className="size-3.5 fill-current" />
                    </span>
                    Play Video
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
