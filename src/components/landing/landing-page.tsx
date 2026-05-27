"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";
import { platformFeeDescriptionEn } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const TRANSACTION_FEE = platformFeeDescriptionEn();

const LandingSystemZones = dynamic(
  () =>
    import("@/components/landing/landing-system-zones").then((m) => ({
      default: m.LandingSystemZones,
    })),
  { loading: () => <div className="min-h-[480px] bg-[#09090b]" aria-hidden /> }
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
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-[#08080c] antialiased">
      <LandingNav />

      <main className="relative z-[2]">
        <LandingHero />
        <LandingTrustStrip />
        <LandingSystemZones />

        <section
          id="pricing"
          className="scroll-mt-14 border-t border-zinc-800/80 bg-[#08080c] text-white"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800/60 px-6 py-3 lg:px-8">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] tabular-nums text-zinc-600">05</span>
              <h2 className="text-[13px] font-medium tracking-tight text-zinc-300">
                Access &amp; pricing
              </h2>
            </div>
            <p className="text-[11px] text-zinc-600">No monthly platform fee</p>
          </div>

          <div className="grid lg:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="border-b border-zinc-800/60 px-6 py-8 lg:border-b-0 lg:border-r lg:border-zinc-800/60 lg:px-8 lg:py-10 last:lg:border-r-0"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-600">
                  {plan.name}
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-medium tracking-[-0.03em] text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[13px] text-zinc-600">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] text-zinc-500">{plan.fee}</p>
                <p className="mt-4 max-w-md text-[14px] leading-relaxed text-zinc-400">
                  {plan.description}
                </p>
                <Button
                  asChild
                  className={
                    plan.primary
                      ? "mt-6 h-9 rounded-md bg-[var(--qr-ember)] px-5 text-[13px] font-medium text-white hover:bg-[var(--qr-ember-hover)]"
                      : "mt-6 h-9 rounded-md px-0 text-[13px] font-medium text-zinc-400 hover:bg-transparent hover:text-white"
                  }
                  variant={plan.primary ? "default" : "ghost"}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <LandingFaq />
      </main>

      <LandingFooter />
    </div>
  );
}
