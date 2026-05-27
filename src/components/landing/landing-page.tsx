"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/product-showcases";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingDenisCreditsNote } from "@/components/landing/landing-denis-credits-note";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";
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

const LandingFeatures = dynamic(
  () =>
    import("@/components/landing/landing-features").then((m) => ({
      default: m.LandingFeatures,
    })),
  {
    loading: () => (
      <div
        className="scroll-mt-24 border-t border-white/[0.06] bg-black py-20 md:py-28"
        aria-hidden
      >
        <div className="mx-auto h-[640px] max-w-[1080px] animate-pulse rounded-2xl bg-white/[0.03]" />
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
    period: "/ month",
    fee: TRANSACTION_FEE,
    description:
      "Full platform. Pay only when guests checkout with card.",
    features: [
      "QR menu & live ordering",
      "Kitchen display & waiter call",
      "Stripe Connect card payments",
      "Bar, counter & table checkout",
      "Analytics & CSV export",
      "Staff accounts & roles",
      "Denis AI credits (optional, pay as you go)",
    ],
    cta: "Start free",
    href: "/signup",
    primary: true,
    complianceNote: "KassenSichV • GDPR • DATEV • TSE included",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    fee: "Volume pricing & dedicated onboarding",
    description: "For chains, hotel F&B, and high-volume venues.",
    features: [
      "Everything in Standard",
      "Multi-location rollout support",
      "Custom integrations",
      "Priority support & SLA options",
      "Dedicated account manager",
    ],
    cta: "Contact sales",
    href: "/enterprise",
    primary: false,
    complianceNote: "KassenSichV • DATEV • TSE included",
  },
];

export function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-black antialiased">
      <LandingNav />

      <main className="relative z-[2]">
        <LandingHero />
        <LandingTrustStrip />
        <LandingFeatures />

        <section
          id="pricing"
          className="scroll-mt-24 border-t border-white/[0.06] bg-black py-20 text-white md:py-28"
        >
          <LandingContainer wide>
            <AnimateInView className="max-w-[480px]">
              <LandingEyebrow inverted>Pricing</LandingEyebrow>
              <LandingHeadline inverted className="mt-3">
                Transparent pricing
              </LandingHeadline>
              <LandingLead inverted className="mt-4">
                No monthly platform fee. Card processing via Stripe with a clear
                per-order fee.
              </LandingLead>
            </AnimateInView>

            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              {plans.map((plan) => (
                <AnimateInView key={plan.name}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-2xl border p-8 sm:p-10",
                      plan.primary
                        ? "border-white/[0.12] bg-white/[0.03] ring-1 ring-white/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02]"
                    )}
                  >
                    {plan.primary && (
                      <span className="absolute -top-3 left-8 rounded-full bg-[var(--qr-ember)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                        Most popular
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
                    <p className="mt-2 text-[14px] font-medium text-[var(--qr-ember)]">
                      {plan.fee}
                    </p>
                    <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                      {plan.description}
                    </p>
                    <ul className="mt-8 flex-1 space-y-2.5 border-t border-white/[0.06] pt-8">
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
                        "mt-8 h-12 w-full rounded-full text-sm font-semibold",
                        plan.primary
                          ? "bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)]"
                          : "border border-white/[0.12] bg-transparent text-zinc-200 hover:bg-white/[0.04] hover:text-white"
                      )}
                      variant={plan.primary ? "default" : "outline"}
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
                  </div>
                </AnimateInView>
              ))}
            </div>

            <LandingDenisCreditsNote />
          </LandingContainer>
        </section>

        <LandingFaq />
      </main>

      <LandingFooter />
    </div>
  );
}
