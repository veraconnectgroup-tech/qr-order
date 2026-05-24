"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/product-showcases";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
  LandingSectionLabel,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const GuestMenuShowcase = dynamic(
  () =>
    import("@/components/landing/guest-menu-showcase").then((m) => ({
      default: m.GuestMenuShowcase,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] text-[13px] text-[var(--lp-dim)]">
        Gast-Menü Live Preview
      </div>
    ),
  }
);

const OrdersShowcase = dynamic(
  () =>
    import("@/components/landing/orders-showcase").then((m) => ({
      default: m.OrdersShowcase,
    })),
  { ssr: false }
);

const CheckoutShowcase = dynamic(
  () =>
    import("@/components/landing/checkout-showcase").then((m) => ({
      default: m.CheckoutShowcase,
    })),
  { ssr: false }
);

type TabId = "gast" | "betrieb" | "zahlung";

const TABS: { id: TabId; label: string }[] = [
  { id: "gast", label: "Gast" },
  { id: "betrieb", label: "Betrieb" },
  { id: "zahlung", label: "Zahlung" },
];

type ProductCard = {
  icon: string;
  title: string;
  description: string;
  bullets: string[];
  featured?: boolean;
  visual?: "guest" | "orders" | "checkout" | "placeholder";
};

const TAB_CONTENT: Record<TabId, ProductCard[]> = {
  gast: [
    {
      icon: "📱",
      title: "QR-Bestellung ohne App",
      description:
        "Gäste scannen den QR-Code und bestellen direkt im Browser. Kein Download, kein Login, kein Warten auf den Kellner.",
      bullets: [
        "Session-Rechnung über mehrere Runden",
        "Modifikatoren, Allergene, Portionsgrößen",
        "KI-gestützte Empfehlungen (optional)",
        "Checkout in unter 15 Sekunden",
      ],
      featured: true,
      visual: "guest",
    },
    {
      icon: "🍳",
      title: "Küchendisplay",
      description:
        "Echtzeit-Bestellungen auf dem Küchenschirm. Automatische Priorisierung, Kellnerruf und Gänge-Management.",
      bullets: [
        "Live-Bestellungen ohne Zettel",
        "Gänge & Modifikator-Ansicht",
        "Touch-optimiert für Tablets",
      ],
    },
    {
      icon: "📊",
      title: "Analyse & Export",
      description:
        "Umsatz, Artikel-Performance und Tisch-Auslastung auf einen Blick. CSV und DATEV-Export für die Buchhaltung.",
      bullets: [
        "Echtzeit-Dashboard",
        "DATEV-kompatible Exporte",
        "Mitarbeiter-Statistiken",
      ],
    },
  ],
  betrieb: [
    {
      icon: "⊞",
      title: "Live-Betrieb",
      description:
        "Bestellungen, Tische und Kellnerrufe in Echtzeit — ein Dashboard für Service und Küche.",
      bullets: [
        "Farbkodierte Bestellstatus",
        "Tisch- und Zonenübersicht",
        "Kellnerruf mit Push-Benachrichtigung",
        "Verlauf und Tagesabschluss",
      ],
      featured: true,
      visual: "orders",
    },
    {
      icon: "◫",
      title: "Tischverwaltung",
      description:
        "QR-Codes pro Tisch, Zonen und Sitzpläne. Gäste scannen und landen direkt am richtigen Tisch.",
      bullets: [
        "QR-Token pro Tisch",
        "Zonen & Bereiche",
        "Bulk-Druck für QR-Codes",
      ],
    },
    {
      icon: "👥",
      title: "Mitarbeiter & Rollen",
      description:
        "Besitzer, Manager, Service und Küche — jede Rolle sieht nur was sie braucht.",
      bullets: [
        "Rollenbasierte Dashboards",
        "PIN-geschützte Aktionen",
        "Multi-Standort-Zugang",
      ],
    },
  ],
  zahlung: [
    {
      icon: "💳",
      title: "Stripe Connect",
      description:
        "Kartenzahlung direkt am Tisch. Apple Pay, Google Pay und Karte — Auszahlung pro Venue.",
      bullets: [
        "Keine monatliche Plattformgebühr",
        "Apple Pay & Google Pay",
        "Auszahlung auf Ihr Bankkonto",
        "PCI-konform über Stripe",
      ],
      featured: true,
      visual: "checkout",
    },
    {
      icon: "✓",
      title: "KassenSichV & TSE",
      description:
        "Jede Transaktion TSE-signiert. Belege und Prüfspur für das Finanzamt inklusive.",
      bullets: [
        "Zertifizierte TSE-Integration",
        "Digitale Belege",
        "GoBD-konforme Archivierung",
      ],
    },
    {
      icon: "📊",
      title: "DATEV-Export",
      description:
        "Buchhaltungsfertige Exporte für Steuerberater und DATEV — ohne manuelles Zusammenkopieren.",
      bullets: [
        "CSV & DATEV-Format",
        "Tages- und Monatsabschlüsse",
        "Umsatz nach Zahlungsart",
      ],
    },
  ],
};

function ProductVisual({ visual }: { visual?: ProductCard["visual"] }) {
  if (visual === "guest") {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-xl border border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] p-4">
        <GuestMenuShowcase hideLabel />
      </div>
    );
  }
  if (visual === "orders") {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] p-4">
        <OrdersShowcase />
      </div>
    );
  }
  if (visual === "checkout") {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] p-4">
        <CheckoutShowcase />
      </div>
    );
  }
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] text-[13px] text-[var(--lp-dim)]">
      Live Preview
    </div>
  );
}

function ProductCardView({ card }: { card: ProductCard }) {
  if (card.featured) {
    return (
      <div className="col-span-full grid gap-8 rounded-2xl border border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] p-8 transition hover:border-[rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.04)] md:grid-cols-2 md:items-center">
        <div>
          <div className="mb-4 flex size-10 items-center justify-center rounded-[10px] border border-[rgba(245,158,11,0.12)] bg-[var(--lp-accent-soft)] text-[18px]">
            {card.icon}
          </div>
          <h3 className="font-display text-[22px] leading-tight text-[var(--lp-ink)]">
            {card.title}
          </h3>
          <p className="mt-2.5 text-[14px] leading-[1.7] text-[var(--lp-muted)]">
            {card.description}
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {card.bullets.map((bullet) => (
              <FeatureCheck key={bullet} accent>
                {bullet}
              </FeatureCheck>
            ))}
          </ul>
        </div>
        <ProductVisual visual={card.visual} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] p-8 transition hover:border-[rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.04)]">
      <div className="mb-4 flex size-10 items-center justify-center rounded-[10px] border border-[rgba(245,158,11,0.12)] bg-[var(--lp-accent-soft)] text-[18px]">
        {card.icon}
      </div>
      <h3 className="font-display text-[22px] leading-tight text-[var(--lp-ink)]">
        {card.title}
      </h3>
      <p className="mt-2.5 text-[14px] leading-[1.7] text-[var(--lp-muted)]">
        {card.description}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {card.bullets.map((bullet) => (
          <FeatureCheck key={bullet} accent>
            {bullet}
          </FeatureCheck>
        ))}
      </ul>
    </div>
  );
}

export function LandingProductShowcase() {
  const [activeTab, setActiveTab] = useState<TabId>("gast");
  const cards = TAB_CONTENT[activeTab];

  return (
    <section id="product" className="scroll-mt-24 py-16 md:py-24">
      <LandingContainer>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingSectionLabel>Plattform</LandingSectionLabel>
          <LandingHeadline className="mt-4">
            Alles, was ein Betrieb braucht.
          </LandingHeadline>
          <LandingLead className="mt-4">
            Von der Bestellung bis zum DATEV-Export. Kein Zusammenkleben von fünf
            verschiedenen Tools.
          </LandingLead>
        </AnimateInView>

        <div className="mt-10 flex justify-center">
          <div className="inline-flex gap-1 rounded-full border border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full px-6 py-2.5 text-[14px] font-medium transition",
                  activeTab === tab.id
                    ? "bg-[var(--lp-accent)] font-semibold text-black"
                    : "text-[var(--lp-subtle)] hover:text-[var(--lp-muted)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <AnimateInView key={`${activeTab}-${card.title}`}>
              <ProductCardView card={card} />
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
