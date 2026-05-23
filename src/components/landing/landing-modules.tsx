"use client";

import { useState } from "react";
import {
  BarChart3,
  ChefHat,
  CreditCard,
  LayoutGrid,
  QrCode,
  Smartphone,
  Users,
} from "lucide-react";
import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const categories = ["All", "Guest", "Operations", "Payments"] as const;

const modules = [
  {
    icon: QrCode,
    title: "QR guest menus",
    description: "Scan to open a mobile-native menu — modifiers, serve sizes, live status.",
    category: "Guest" as const,
  },
  {
    icon: Smartphone,
    title: "Session ordering",
    description: "Guests add to a table session bill without creating an account.",
    category: "Guest" as const,
  },
  {
    icon: LayoutGrid,
    title: "Floor board",
    description: "Zones, tables, QR codes, session totals, and attention states.",
    category: "Operations" as const,
  },
  {
    icon: ChefHat,
    title: "Kitchen display",
    description: "Prep line with timers and large tap targets for peak service.",
    category: "Operations" as const,
  },
  {
    icon: Users,
    title: "Waiter calls",
    description: "Guests request staff from the table — hosts see it instantly.",
    category: "Operations" as const,
  },
  {
    icon: CreditCard,
    title: "Stripe Connect",
    description: "Card payments routed to each venue with clear per-order fees.",
    category: "Payments" as const,
  },
  {
    icon: CreditCard,
    title: "Pay in person",
    description: "Bar, counter, or table checkout — configured per location.",
    category: "Payments" as const,
  },
  {
    icon: BarChart3,
    title: "Analytics & export",
    description: "Daily revenue, filters, and CSV export for finance teams.",
    category: "Operations" as const,
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
    <section id="modules" className="scroll-mt-24 bg-zinc-950 py-20 text-white sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingHeadline inverted>
            There&apos;s a module for that.
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

        <StaggerInView className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map(({ icon: Icon, title, description }) => (
            <StaggerItem
              key={title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800">
                <Icon className="size-4 text-[var(--lp-accent)]" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-[14px] font-semibold text-white">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                {description}
              </p>
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
