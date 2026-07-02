"use client";

import Link from "next/link";
import { ArrowRight, Play, Radio, ShieldCheck } from "lucide-react";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroDenisDemo } from "@/components/landing/landing-hero-denis-demo";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

const HERO_PROOF = {
  en: [
    { label: "Open tables", value: "18", detail: "3 need action" },
    { label: "Station truth", value: "Bar ready", detail: "Kitchen in prep" },
    { label: "Next action", value: "Pickup", detail: "Waiter notified" },
  ],
  de: [
    { label: "Offene Tische", value: "18", detail: "3 brauchen Aktion" },
    { label: "Station Truth", value: "Bar fertig", detail: "Küche läuft" },
    { label: "Nächste Aktion", value: "Abholen", detail: "Service informiert" },
  ],
  sr: [
    { label: "Otvorenih stolova", value: "18", detail: "3 traže akciju" },
    { label: "Station truth", value: "Bar spreman", detail: "Kuhinja radi" },
    { label: "Sledeća akcija", value: "Preuzmi", detail: "Konobar obavešten" },
  ],
} as const;

export function LandingHero() {
  const { copy, locale } = useLandingCopy();
  const { hero } = copy;
  const proof = HERO_PROOF[locale] ?? HERO_PROOF.en;

  return (
    <section className="relative overflow-hidden bg-black pt-28 pb-12 md:pt-32 md:pb-16">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-white/[0.08]"
      />
      <LandingContainer wide>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)] lg:items-center xl:gap-16">
          <HeroStagger className="w-full max-w-[620px]">
            <HeroItem>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-zinc-300">
                <Radio className="size-3.5 text-[var(--qr-ember)]" />
                <span>{hero.eyebrow}</span>
              </div>
            </HeroItem>
            <HeroItem>
              <h1 className="mt-5 font-display text-5xl font-medium leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
                {hero.title}
                <span className="text-zinc-400">{hero.titleAccent}</span>
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 max-w-[560px] text-[17px] leading-[1.75] text-zinc-400 sm:text-lg">
                {hero.lead}
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="h-12 rounded-md bg-[var(--qr-ember)] px-6 text-sm font-semibold text-white hover:bg-[var(--qr-ember-hover)]"
                >
                  <Link href="/signup">
                    {hero.cta}
                    <ArrowRight className="ms-2 size-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-md border-white/[0.12] bg-transparent px-6 text-sm text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                >
                  <Link href="/skyline-lounge/demo-table-8">
                    <Play className="me-2 size-4" />
                    {hero.ctaSecondary}
                  </Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <div className="mt-6 flex items-center gap-2 text-[13px] text-zinc-500">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>{hero.meta}</span>
              </div>
            </HeroItem>
            <HeroItem>
              <div className="mt-10 grid overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] sm:grid-cols-3">
                {proof.map((item) => (
                  <div
                    key={item.label}
                    className="border-b border-white/[0.08] px-4 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
                  >
                    <p className="text-[11px] uppercase tracking-normal text-zinc-600">
                      {item.label}
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </HeroItem>
          </HeroStagger>

          <div className="w-full min-w-0">
            <LandingHeroDenisDemo />
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
