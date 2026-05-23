"use client";

import { useState } from "react";
import {
  BarChart3,
  ChefHat,
  CreditCard,
  Heart,
  LayoutGrid,
  QrCode,
  Smartphone,
  Split,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import {
  ModulePreviewAnalytics,
  ModulePreviewFloor,
  ModulePreviewInPerson,
  ModulePreviewKitchen,
  ModulePreviewQr,
  ModulePreviewSession,
  ModulePreviewSplit,
  ModulePreviewStripe,
  ModulePreviewTips,
  ModulePreviewWaiter,
} from "@/components/landing/module-previews";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const categories = ["All", "Guest", "Operations", "Payments"] as const;

type ModulePreview = React.ComponentType;

const modules: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  category: Exclude<(typeof categories)[number], "All">;
  Preview: ModulePreview;
}> = [
  {
    icon: QrCode,
    title: "QR guest menus",
    description: "Scan to open a mobile-native menu — modifiers, serve sizes, live status.",
    category: "Guest",
    Preview: ModulePreviewQr,
  },
  {
    icon: Smartphone,
    title: "Session ordering",
    description: "Guests add to a table session bill without creating an account.",
    category: "Guest",
    Preview: ModulePreviewSession,
  },
  {
    icon: LayoutGrid,
    title: "Floor board",
    description: "Zones, tables, QR codes, session totals, and attention states.",
    category: "Operations",
    Preview: ModulePreviewFloor,
  },
  {
    icon: ChefHat,
    title: "Kitchen display",
    description: "Prep line with timers and large tap targets for peak service.",
    category: "Operations",
    Preview: ModulePreviewKitchen,
  },
  {
    icon: Users,
    title: "Waiter calls",
    description: "Guests request staff from the table — hosts see it instantly.",
    category: "Operations",
    Preview: ModulePreviewWaiter,
  },
  {
    icon: CreditCard,
    title: "Stripe Connect",
    description: "Card payments routed to each venue with clear per-order fees.",
    category: "Payments",
    Preview: ModulePreviewStripe,
  },
  {
    icon: CreditCard,
    title: "Pay in person",
    description: "Bar, counter, or table checkout — configured per location.",
    category: "Payments",
    Preview: ModulePreviewInPerson,
  },
  {
    icon: Split,
    title: "Split bill",
    description: "Guests divide the check equally or by items — each pays their share.",
    category: "Payments",
    Preview: ModulePreviewSplit,
  },
  {
    icon: Heart,
    title: "Digital tips",
    description: "MwSt-free tips at checkout — routed to assigned staff automatically.",
    category: "Payments",
    Preview: ModulePreviewTips,
  },
  {
    icon: BarChart3,
    title: "Analytics & export",
    description: "Daily revenue, filters, and CSV export for finance teams.",
    category: "Operations",
    Preview: ModulePreviewAnalytics,
  },
];

export function LandingModules() {
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All");

  const filtered =
    category === "All"
      ? modules
      : modules.filter((m) => m.category === category);

  return (
    <section id="modules" className="scroll-mt-24 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingHeadline inverted>
            Every module your venue needs
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            Run guest ordering, floor ops, kitchen, and payments without opening
            four different tools.
          </LandingLead>
        </AnimateInView>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-medium transition",
                category === cat
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <StaggerInView className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(({ icon: Icon, title, description, Preview }) => (
            <StaggerItem
              key={title}
              className="landing-module-card group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition duration-200 hover:scale-[1.02] hover:border-orange-500/40 hover:shadow-[0_0_40px_rgba(234,88,12,0.12)]"
            >
              <div className="p-3 pb-0">
                <Preview />
              </div>
              <div className="p-5 pt-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 transition group-hover:bg-orange-500/15">
                  <Icon
                    className="size-4 text-[var(--lp-accent)] transition group-hover:text-orange-400"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="mt-4 text-[14px] font-semibold text-white">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                  {description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerInView>

        <AnimateInView className="mt-10 text-center">
          <p className="text-[14px] text-zinc-500">
            Plus staff roles, multi-location, and enterprise rollout →{" "}
            <a
              href="/enterprise"
              className="font-medium text-[var(--lp-accent)] hover:underline"
            >
              Explore enterprise
            </a>
          </p>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
