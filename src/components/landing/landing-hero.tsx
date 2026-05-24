"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  HeroItem,
  HeroStagger,
  AnimateInView,
} from "@/components/landing/animate-in-view";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

const LandingHeroVisual = dynamic(
  () =>
    import("@/components/landing/landing-hero-visual").then((m) => ({
      default: m.LandingHeroVisual,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-[4/3] w-full animate-pulse rounded-2xl border border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] lg:min-h-[460px]"
        aria-hidden
      />
    ),
  }
);

function HeroGlow() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[10%] top-[-10%] h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_70%_55%_at_50%_30%,var(--lp-accent-glow),transparent_70%)] opacity-60"
        style={{ left: "50%" }}
        animate={{ opacity: [0.45, 0.65, 0.45] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute -bottom-[20%] -right-[10%] h-[500px] w-[600px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.06),transparent_60%)]" />
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="landing-glow-top relative flex min-h-[90vh] items-center overflow-hidden pt-[140px] pb-20">
      <HeroGlow />
      <LandingContainer wide className="relative z-[2]">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <HeroStagger className="max-w-[620px] lg:max-w-none">
            <HeroItem>
              <p className="mb-5 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lp-accent)]">
                <span className="h-px w-6 bg-[var(--lp-accent)] opacity-60" aria-hidden />
                Enterprise Hospitality Platform
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="font-display text-[clamp(2.8rem,5vw,4rem)] leading-[1.05] tracking-[-0.02em]">
                <span className="landing-gradient-text">
                  Ein System für
                  <br />
                  jeden Tisch.
                </span>
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-5 max-w-[500px] text-[18px] leading-[1.7] text-[var(--lp-muted)]">
                Bestellung, Küchendisplay, Kartenzahlung und DATEV-Export — ein System
                statt fünf. Entwickelt für{" "}
                <span className="font-medium text-[var(--lp-accent-light)]">
                  Restaurants
                </span>{" "}
                in Deutschland.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  asChild
                  className="landing-btn-accent h-[52px] rounded-full px-8 text-[15px] font-semibold"
                >
                  <Link href="/signup">Kostenlos starten</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-[52px] rounded-full border-[var(--lp-border)] bg-transparent px-8 text-[15px] font-medium text-[var(--lp-ink)] hover:bg-[var(--lp-surface)] hover:text-[var(--lp-ink)]"
                >
                  <Link href="/skyline-lounge/demo-table-8">
                    Live-Demo ansehen →
                  </Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <div className="mt-7 flex flex-wrap items-center gap-4 text-[13px] text-[var(--lp-dim)]">
                <span>0 €/Monat</span>
                <span className="size-[3px] rounded-full bg-[var(--lp-dim)]" />
                <span>KassenSichV-konform</span>
                <span className="size-[3px] rounded-full bg-[var(--lp-dim)]" />
                <span>30 Min Setup</span>
              </div>
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
