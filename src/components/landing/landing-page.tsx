"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/product-showcases";
import { LandingClosingShowcase } from "@/components/landing/landing-closing-showcase";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingModules } from "@/components/landing/landing-modules";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingWorkflows } from "@/components/landing/landing-workflows";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { platformFeeDescriptionEn } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRANSACTION_FEE = platformFeeDescriptionEn();

const LandingProductTabs = dynamic(
  () =>
    import("@/components/landing/landing-product-tabs").then((m) => ({
      default: m.LandingProductTabs,
    })),
  {
    loading: () => (
      <div
        className="scroll-mt-24 border-t border-zinc-800 bg-zinc-950 py-16 md:py-20"
        aria-hidden
      >
        <div className="mx-auto h-[640px] max-w-[1080px] animate-pulse rounded-2xl bg-zinc-900/40" />
      </div>
    ),
  }
);

const plans: Array<{
  name: string;
  price: string;
  period: string;
  fee: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  primary: boolean;
  complianceNote?: string;
}> = [
  {
    name: "Standard",
    price: "€0",
    period: "/ Monat",
    fee: TRANSACTION_FEE,
    description: "Volle Plattform. Zahlen Sie nur wenn Gäste mit Karte bezahlen.",
    features: [
      "QR-Speisekarte & Live-Bestellungen",
      "Küchendisplay & Kellnerruf",
      "Stripe Connect Kartenzahlung",
      "Bar-, Theken- & Tischkasse",
      "Analyse & CSV-Export",
      "Mitarbeiter & Rollen",
    ],
    cta: "Kostenlos starten",
    href: "/signup",
    primary: true,
    complianceNote: "KassenSichV • DSGVO • DATEV • TSE inklusive",
  },
  {
    name: "Enterprise",
    price: "Individuell",
    period: "",
    fee: "Mengenrabatt & persönliches Onboarding",
    description: "Für Ketten, Hotel-F&B und Betriebe mit hohem Volumen.",
    features: [
      "Alles aus Standard",
      "Multi-Standort Rollout-Support",
      "Individuelle Integrationen",
      "Prioritäts-Support & SLA-Optionen",
      "Persönlicher Ansprechpartner",
    ],
    cta: "Vertrieb kontaktieren",
    href: "/enterprise",
    primary: false,
    complianceNote: "KassenSichV • DATEV • TSE inklusive",
  },
];

export function LandingPage() {
  return (
    <div className="landing-page landing-raycast relative min-h-screen overflow-x-hidden bg-zinc-950 antialiased">
      <LandingNav />

      <main className="relative z-[2]">
        <LandingHero />
        <LandingTrustStrip />
        <LandingPhilosophy />
        <LandingModules />
        <LandingProductTabs />
        <LandingTestimonials />
        <LandingWorkflows />

        <section
          id="pricing"
          className="scroll-mt-24 border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20"
        >
          <LandingContainer wide>
            <AnimateInView className="max-w-[480px]">
              <LandingEyebrow inverted>Preise</LandingEyebrow>
              <LandingHeadline inverted className="mt-3">
                Transparente Preise
              </LandingHeadline>
              <LandingLead inverted className="mt-4">
                Keine monatliche Plattformgebühr. Kartenabwicklung über Stripe
                mit klarer Gebühr pro Bestellung.
              </LandingLead>
            </AnimateInView>

            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              {plans.map((plan) => (
                <AnimateInView key={plan.name}>
                  <div
                    className={cn(
                      "landing-glow-border relative flex h-full flex-col rounded-xl border p-8 sm:p-10",
                      plan.primary
                        ? "landing-pricing-border landing-pricing-glass ring-1 ring-white/10"
                        : "border-zinc-800 bg-zinc-900/40"
                    )}
                  >
                    {plan.primary && (
                      <span className="absolute -top-3 left-8 rounded-full bg-orange-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]">
                        Beliebteste Wahl
                      </span>
                    )}
                    <p className="text-[13px] font-medium uppercase tracking-wider text-zinc-500">
                      {plan.name}
                    </p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-display text-4xl font-medium tracking-[-0.03em] text-white">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-[14px] text-zinc-400">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[14px] font-medium text-[var(--lp-accent)]">
                      {plan.fee}
                    </p>
                    <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                      {plan.description}
                    </p>
                    <ul className="mt-8 flex-1 space-y-2.5 border-t border-zinc-800 pt-8">
                      {plan.features.map((feat) => (
                        <FeatureCheck key={feat} accent>
                          {feat}
                        </FeatureCheck>
                      ))}
                    </ul>
                    {plan.complianceNote && (
                      <p className="mt-6 text-[12px] font-medium tracking-wide text-zinc-500">
                        {plan.complianceNote}
                      </p>
                    )}
                    <Button
                      asChild
                      className={cn(
                        "mt-8 h-11 w-full rounded-full text-sm font-semibold",
                        plan.primary
                          ? "landing-btn-accent"
                          : "border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800 hover:text-white"
                      )}
                      variant={plan.primary ? "default" : "outline"}
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
                  </div>
                </AnimateInView>
              ))}
            </div>
          </LandingContainer>
        </section>

        <LandingFaq />

        <LandingClosingShowcase />
      </main>
    </div>
  );
}
