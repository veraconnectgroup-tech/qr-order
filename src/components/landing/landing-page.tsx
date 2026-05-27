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
  { loading: () => <div className="min-h-[480px] bg-[var(--lp-bg)]" aria-hidden /> }
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
    <div className="landing-page relative min-h-screen overflow-x-hidden antialiased">
      <LandingNav />

      <main className="relative z-[2] overflow-x-hidden">
        <LandingHero />
        <LandingTrustStrip />
        <LandingSystemZones />

        <section
          id="pricing"
          className="scroll-mt-14 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)]"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--lp-border-subtle)] px-6 py-3 lg:px-8">
            <h2 className="landing-zone-label">Access &amp; pricing</h2>
            <p className="landing-meta">No monthly platform fee</p>
          </div>

          <div className="grid lg:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="border-b border-[var(--lp-border-subtle)] px-6 py-8 lg:border-b-0 lg:border-r lg:px-8 lg:py-10 last:lg:border-r-0"
              >
                <p className="landing-meta uppercase tracking-[0.12em]">{plan.name}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-medium tracking-[-0.03em] text-[var(--lp-ink)]">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[13px] text-[var(--lp-muted)]">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] text-[var(--lp-muted)]">{plan.fee}</p>
                <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[var(--lp-muted)]">
                  {plan.description}
                </p>
                <Button
                  asChild
                  className={
                    plan.primary
                      ? "mt-6 h-9 rounded-md bg-[var(--lp-ember)] px-5 text-[13px] font-medium text-white hover:bg-[var(--lp-ember-hover)]"
                      : "mt-6 h-9 rounded-md px-0 text-[13px] font-medium text-[var(--lp-muted)] hover:bg-transparent hover:text-[var(--lp-ink)]"
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
