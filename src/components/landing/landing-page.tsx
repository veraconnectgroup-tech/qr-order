"use client";

import Link from "next/link";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingClosingShowcase } from "@/components/landing/landing-closing-showcase";
import { LandingEnterpriseHome } from "@/components/landing/landing-enterprise-home";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingProductShowcase } from "@/components/landing/landing-product-showcase";
import { LandingSocialProof } from "@/components/landing/landing-social-proof";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
  LandingSectionLabel,
} from "@/components/landing/landing-primitives";
import { FeatureCheck } from "@/components/landing/product-showcases";
import { platformFeeDescriptionEn } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRANSACTION_FEE = platformFeeDescriptionEn();

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
    <div className="landing-page landing-raycast relative min-h-screen overflow-x-hidden antialiased">
      <LandingNav />

      <main className="relative z-[2]">
        <LandingHero />
        <LandingTrustStrip />
        <LandingSocialProof />
        <LandingProductShowcase />
        <LandingEnterpriseHome />

        <section id="pricing" className="scroll-mt-24 py-16 md:py-24">
          <LandingContainer>
            <AnimateInView className="mx-auto max-w-[640px] text-center">
              <LandingSectionLabel>Preise</LandingSectionLabel>
              <LandingHeadline className="mt-4">Transparente Preise.</LandingHeadline>
              <LandingLead className="mt-4">
                Keine monatliche Plattformgebühr. Kartenabwicklung über Stripe mit
                klarer Gebühr pro Bestellung.
              </LandingLead>
            </AnimateInView>

            <div className="mx-auto mt-14 grid max-w-[880px] gap-6 lg:grid-cols-2">
              {plans.map((plan) => (
                <AnimateInView key={plan.name}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-[20px] border p-9",
                      plan.primary
                        ? "border-[var(--lp-accent)] bg-[var(--lp-surface)] shadow-[0_0_40px_rgba(245,158,11,0.08)]"
                        : "border-[var(--lp-border-subtle)] bg-[var(--lp-surface)]"
                    )}
                  >
                    {plan.primary && (
                      <span className="absolute -top-3 left-6 rounded-full bg-[var(--lp-accent)] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-black">
                        Beliebteste Wahl
                      </span>
                    )}
                    <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--lp-subtle)]">
                      {plan.name}
                    </p>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span
                        className={cn(
                          "font-display font-normal tracking-[-0.02em] text-[var(--lp-ink)]",
                          plan.primary ? "text-[48px]" : "text-[36px]"
                        )}
                      >
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-[16px] text-[var(--lp-muted)]">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] font-medium text-[var(--lp-accent)]">
                      {plan.fee}
                    </p>
                    <p className="mt-4 border-b border-[var(--lp-border-subtle)] pb-6 text-[14px] leading-relaxed text-[var(--lp-muted)]">
                      {plan.description}
                    </p>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((feat) => (
                        <FeatureCheck key={feat} accent>
                          {feat}
                        </FeatureCheck>
                      ))}
                    </ul>
                    {plan.complianceNote && (
                      <p className="mt-6 text-[12px] text-[var(--lp-dim)]">
                        {plan.complianceNote}
                      </p>
                    )}
                    <Button
                      asChild
                      className={cn(
                        "mt-7 h-12 w-full rounded-xl text-[15px] font-semibold",
                        plan.primary
                          ? "landing-btn-accent"
                          : "border border-[var(--lp-border)] bg-transparent text-[var(--lp-ink)] hover:bg-[var(--lp-surface-raised)]"
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

        <LandingClosingShowcase />
      </main>
    </div>
  );
}
