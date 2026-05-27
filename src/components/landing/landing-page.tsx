"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { platformFeeDescriptionEn } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const TRANSACTION_FEE = platformFeeDescriptionEn();

const LandingFeatures = dynamic(
  () =>
    import("@/components/landing/landing-features").then((m) => ({
      default: m.LandingFeatures,
    })),
  { loading: () => <div className="bg-black py-24 md:py-36" aria-hidden /> }
);

const plans = [
  {
    name: "Standard",
    price: "€0",
    period: "/ month",
    fee: TRANSACTION_FEE,
    description: "Full platform. Pay only when guests checkout with card.",
    cta: "Start free",
    href: "/signup",
    primary: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    fee: "Volume pricing & dedicated onboarding",
    description: "For chains, hotel F&B, and high-volume venues.",
    cta: "Contact sales",
    href: "/enterprise",
    primary: false,
  },
] as const;

export function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-black antialiased">
      <LandingNav />

      <main className="relative z-[2]">
        <LandingHero />
        <LandingTrustStrip />
        <LandingFeatures />

        <section id="pricing" className="scroll-mt-24 bg-black py-24 text-white md:py-36">
          <LandingContainer wide>
            <AnimateInView className="max-w-[440px]">
              <LandingHeadline inverted className="text-[clamp(1.75rem,3vw,2.25rem)]">
                Pricing
              </LandingHeadline>
              <LandingLead inverted className="mt-6 text-[16px] leading-[1.7] text-zinc-500">
                No monthly platform fee. Card processing via Stripe with a clear
                per-order fee.
              </LandingLead>
            </AnimateInView>

            <div className="mt-20 grid gap-16 lg:grid-cols-2 lg:gap-24">
              {plans.map((plan) => (
                <AnimateInView key={plan.name}>
                  <div className="max-w-md">
                    <p className="text-sm text-zinc-600">{plan.name}</p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-4xl font-medium tracking-[-0.03em] text-white">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-zinc-500">{plan.period}</span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">{plan.fee}</p>
                    <p className="mt-4 text-[15px] leading-[1.7] text-zinc-400">
                      {plan.description}
                    </p>
                    <Button
                      asChild
                      className={
                        plan.primary
                          ? "mt-8 h-11 rounded-md bg-[var(--qr-ember)] px-8 text-sm font-medium text-white hover:bg-[var(--qr-ember-hover)]"
                          : "mt-8 h-11 rounded-md px-0 text-sm font-medium text-zinc-400 hover:bg-transparent hover:text-white"
                      }
                      variant={plan.primary ? "default" : "ghost"}
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
      </main>

      <LandingFooter />
    </div>
  );
}
