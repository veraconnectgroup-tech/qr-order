"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import {
  HeroItem,
  HeroStagger,
  AnimateInView,
} from "@/components/landing/animate-in-view";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="landing-hero-dark landing-dot-grid landing-glow-top relative overflow-hidden pt-20 pb-12">
      <LandingContainer wide className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 xl:gap-16">
          <HeroStagger className="max-w-[620px] lg:max-w-none">
            <HeroItem>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-500">
                Hospitality OS
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="font-display text-[clamp(2.5rem,5.5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-white">
                The operating system for modern hospitality.
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-zinc-400 sm:text-[18px]">
                QR ordering, live kitchen ops, table management, and Stripe
                payments — unified in one platform. Built for restaurants, bars,
                and hotel F&amp;B in Germany.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  asChild
                  className="landing-btn-accent h-12 rounded-full px-8 text-sm font-semibold"
                >
                  <Link href="/signup">Start free</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-zinc-700 bg-transparent px-8 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:text-white"
                >
                  <Link href="#product" className="inline-flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-orange-500/15">
                      <Play className="size-3.5 fill-orange-400 text-orange-400" />
                    </span>
                    Watch 60s demo
                  </Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 text-[13px] leading-relaxed text-zinc-500">
                Used by early operators across Germany · 0€/month · Live in{" "}
                <span className="text-zinc-400">&lt; 30 min</span>
              </p>
            </HeroItem>
          </HeroStagger>

          <AnimateInView className="relative lg:min-h-[460px]" delay={0.15}>
            <LandingHeroVisual />
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
