"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
  LandingSection,
} from "@/components/landing/landing-primitives";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import {
  ShowcasePhone,
  ShowcaseWindow,
} from "@/components/landing/showcase-frame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Governance at scale",
    description:
      "Organizations, locations, zones, and tables in a single hierarchy. Role-based access for owners, managers, floor, and kitchen — without shared logins.",
  },
  {
    title: "Payments you can audit",
    description:
      "Stripe Connect per venue, session billing, in-person and online checkout, and export-ready order history for finance teams.",
  },
  {
    title: "Rollout with structure",
    description:
      "Dedicated onboarding for menu migration, QR deployment, staff training, and go-live — designed for groups opening multiple concepts.",
  },
];

const proofPoints = [
  { value: "Multi-location", label: "Native org & venue model" },
  { value: "Stripe Connect", label: "Per-venue payouts & PCI" },
  { value: "Real-time", label: "Live orders, tables & calls" },
  { value: "CSV export", label: "Finance-ready reporting" },
];

type LandingEnterpriseProps = {
  fullPage?: boolean;
};

export function LandingEnterprise({ fullPage = false }: LandingEnterpriseProps) {
  return (
    <>
      <LandingSection
        id={fullPage ? undefined : "enterprise"}
        variant="tint"
        className={cn("py-24 sm:py-32", fullPage && "pt-32")}
      >
        <LandingContainer>
          <AnimateInView className="max-w-[720px]">
            <LandingEyebrow>Enterprise</LandingEyebrow>
            <LandingHeadline className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)]">
              Infrastructure for hospitality groups
            </LandingHeadline>
            <LandingLead className="mt-5 max-w-[600px]">
              When you operate more than one venue, you need software that
              matches how your business is structured — not a single-location
              tool scaled up with spreadsheets.
            </LandingLead>
          </AnimateInView>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map((point) => (
              <AnimateInView key={point.label}>
                <div className="border-t border-zinc-300/70 pt-5">
                  <p className="text-[15px] font-medium tracking-[-0.02em] text-zinc-950">
                    {point.value}
                  </p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500">
                    {point.label}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>
        </LandingContainer>
      </LandingSection>

      <LandingSection variant="surface" className="border-t border-[var(--lp-border)] pb-24 sm:pb-32">
        <LandingContainer>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <AnimateInView>
              <LandingHeadline className="text-[clamp(1.5rem,3vw,2.25rem)]">
                Every location on one live operations layer
              </LandingHeadline>
              <LandingLead className="mt-5">
                Orders board, kitchen display, table sessions, waiter calls, and
                payment requests — synchronized across every venue your team runs.
              </LandingLead>
            </AnimateInView>
            <AnimateInView delay={0.08}>
              <ShowcaseWindow
                url="app.qr-order.com/dashboard/orders"
                theme="light"
                className="shadow-[var(--lp-shadow-lg)] ring-1 ring-[var(--lp-border)]"
              >
                <DashboardScreenShowcase screen="orders" variant="hero" theme="light" />
              </ShowcaseWindow>
            </AnimateInView>
          </div>
        </LandingContainer>
      </LandingSection>

      <LandingSection variant="tint" className="border-t border-[var(--lp-border)] pb-24 sm:pb-32">
        <LandingContainer>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <AnimateInView className="order-2 lg:order-1">
              <ShowcaseWindow
                url="app.qr-order.com/dashboard/tables"
                theme="light"
                className="shadow-[var(--lp-shadow-lg)] ring-1 ring-[var(--lp-border)]"
              >
                <DashboardScreenShowcase screen="tables" variant="hero" theme="light" />
              </ShowcaseWindow>
            </AnimateInView>
            <AnimateInView className="order-1 lg:order-2">
              <LandingHeadline className="text-[clamp(1.5rem,3vw,2.25rem)]">
                Floor visibility before guests have to ask
              </LandingHeadline>
              <LandingLead className="mt-5">
                Zones, QR codes, session totals, and attention states give hosts
                and managers a single source of truth during service.
              </LandingLead>
            </AnimateInView>
          </div>
        </LandingContainer>
      </LandingSection>

      <LandingSection variant="surface" className="border-t border-[var(--lp-border)] pb-24 sm:pb-32">
        <LandingContainer>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.85fr] lg:gap-20">
            <AnimateInView>
              <LandingHeadline className="text-[clamp(1.5rem,3vw,2.25rem)]">
                Guest experience that converts — without an app
              </LandingHeadline>
              <LandingLead className="mt-5">
                Mobile-native menus, modifiers, session billing, and checkout
                configured per venue — bar, counter, table, or card online.
              </LandingLead>
            </AnimateInView>
            <AnimateInView delay={0.08} className="flex justify-center lg:justify-end">
              <ShowcasePhone hideLabel className="max-w-[280px]">
                <ScaledPhonePreview designHeight={560}>
                  <GuestMenuContent variant="hero" />
                </ScaledPhonePreview>
              </ShowcasePhone>
            </AnimateInView>
          </div>
        </LandingContainer>
      </LandingSection>

      <LandingSection variant="tint" className="border-t border-[var(--lp-border)] py-24 sm:py-32">
        <LandingContainer>
          <div className="grid gap-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-24">
            <AnimateInView>
              <LandingEyebrow>Why groups choose QR Order</LandingEyebrow>
              <LandingHeadline className="mt-4">
                Built for operators, not hobby projects
              </LandingHeadline>
              <div className="mt-10 space-y-8">
                {pillars.map((pillar) => (
                  <div key={pillar.title} className="border-t border-zinc-200 pt-6">
                    <h3 className="text-[15px] font-medium text-zinc-900">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
                      {pillar.description}
                    </p>
                  </div>
                ))}
              </div>
            </AnimateInView>

            <AnimateInView delay={0.1}>
              <blockquote className="font-display text-[clamp(1.35rem,2.5vw,1.85rem)] font-medium leading-[1.35] tracking-[-0.025em] text-zinc-800">
                &ldquo;We evaluated three QR ordering vendors. QR Order was the
                only platform that felt like operational software — not a menu
                PDF with payments attached.&rdquo;
              </blockquote>
              <footer className="mt-8 border-t border-zinc-200 pt-6">
                <p className="text-[14px] font-medium text-zinc-900">
                  Director of Operations
                </p>
                <p className="mt-1 text-[14px] text-zinc-500">
                  Multi-concept hospitality group · 6 locations
                </p>
              </footer>
            </AnimateInView>
          </div>
        </LandingContainer>
      </LandingSection>

      <LandingSection variant="surface" className="border-t border-[var(--lp-border)] py-20 sm:py-24">
        <LandingContainer className="text-center">
          <AnimateInView>
            <LandingHeadline className="mx-auto max-w-[640px]">
              Speak with our team about your rollout
            </LandingHeadline>
            <LandingLead className="mx-auto mt-4 max-w-[520px]">
              Volume pricing, multi-location onboarding, and custom integration
              options for hotel F&B, bar groups, and high-throughput venues.
            </LandingLead>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-11 rounded-full bg-zinc-950 px-7 text-sm font-medium text-white hover:bg-zinc-800"
              >
                <a href="mailto:hello@qrorder.app?subject=Enterprise%20inquiry">
                  Contact sales
                  <ArrowRight className="ml-1.5 size-4" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-11 rounded-full border-zinc-300 bg-white px-7 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <Link href="/signup">Start with Standard</Link>
              </Button>
            </div>
          </AnimateInView>
        </LandingContainer>
      </LandingSection>
    </>
  );
}
