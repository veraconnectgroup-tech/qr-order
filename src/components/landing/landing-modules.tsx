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
  Sparkles,
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
  ModulePreviewAi,
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

const categories = ["Alle", "Gast", "Betrieb", "Zahlung"] as const;

type ModulePreview = React.ComponentType;

const modules: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  category: Exclude<(typeof categories)[number], "Alle">;
  Preview: ModulePreview;
  featured?: boolean;
}> = [
  {
    icon: QrCode,
    title: "QR-Speisekarte",
    description:
      "Gäste scannen und sehen eine mobile Karte — Modifikatoren, Portionsgrößen, Live-Status.",
    category: "Gast",
    Preview: ModulePreviewQr,
    featured: true,
  },
  {
    icon: Smartphone,
    title: "Session-Bestellung",
    description:
      "Gäste bestellen auf eine Tisch-Rechnung — ohne Konto, ohne App.",
    category: "Gast",
    Preview: ModulePreviewSession,
  },
  {
    icon: Sparkles,
    title: "KI-Concierge",
    description:
      "Intelligenter Sommelier — Allergien, Stimmung, personalisierte Empfehlungen.",
    category: "Gast",
    Preview: ModulePreviewAi,
  },
  {
    icon: LayoutGrid,
    title: "Tischplan",
    description:
      "Zonen, Tische, QR-Codes, Session-Umsätze und Aufmerksamkeits-Status.",
    category: "Betrieb",
    Preview: ModulePreviewFloor,
  },
  {
    icon: ChefHat,
    title: "Küchendisplay",
    description:
      "Zubereitungslinie mit Timern und großen Buttons für den Küchenbetrieb.",
    category: "Betrieb",
    Preview: ModulePreviewKitchen,
    featured: true,
  },
  {
    icon: Users,
    title: "Kellnerruf",
    description:
      "Gäste rufen Personal vom Tisch aus — das Team sieht es sofort.",
    category: "Betrieb",
    Preview: ModulePreviewWaiter,
  },
  {
    icon: CreditCard,
    title: "Stripe Connect",
    description:
      "Kartenzahlung pro Standort mit transparenten Gebühren pro Bestellung.",
    category: "Zahlung",
    Preview: ModulePreviewStripe,
    featured: true,
  },
  {
    icon: CreditCard,
    title: "Vor-Ort-Zahlung",
    description:
      "Bar-, Theken- oder Tischkasse — konfigurierbar pro Standort.",
    category: "Zahlung",
    Preview: ModulePreviewInPerson,
  },
  {
    icon: Split,
    title: "Rechnung teilen",
    description:
      "Gäste teilen gleichmäßig oder nach Artikeln — jeder zahlt seinen Anteil.",
    category: "Zahlung",
    Preview: ModulePreviewSplit,
  },
  {
    icon: Heart,
    title: "Digitales Trinkgeld",
    description:
      "MwSt-freies Trinkgeld beim Checkout — automatisch dem Personal zugeordnet.",
    category: "Zahlung",
    Preview: ModulePreviewTips,
  },
  {
    icon: BarChart3,
    title: "Analyse & Export",
    description:
      "Tagesumsatz, Filter und CSV-Export für Buchhaltung und DATEV.",
    category: "Betrieb",
    Preview: ModulePreviewAnalytics,
  },
];

export function LandingModules() {
  const [category, setCategory] =
    useState<(typeof categories)[number]>("Alle");

  const filtered =
    category === "Alle"
      ? modules
      : modules.filter((m) => m.category === category);

  return (
    <section id="modules" className="scroll-mt-24 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingHeadline inverted>
            Jedes Modul das Ihr Betrieb braucht
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            Gästebestellung, Tischplan, Küche und Zahlungen — ohne vier
            verschiedene Tools.
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

        <StaggerInView className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map(({ icon: Icon, title, description, Preview, featured }) => (
            <StaggerItem
              key={title}
              className={cn(
                "landing-glow-border landing-module-card group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition duration-200 hover:border-orange-500/40 hover:bg-gradient-to-br hover:from-orange-500/[0.06] hover:to-transparent hover:shadow-[0_0_40px_rgba(234,88,12,0.12)]",
                featured && "sm:col-span-2"
              )}
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
            Plus Mitarbeiterrollen, Multi-Standort und Enterprise-Rollout →{" "}
            <a
              href="/enterprise"
              className="font-medium text-[var(--lp-accent)] hover:underline"
            >
              Enterprise entdecken
            </a>
          </p>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
