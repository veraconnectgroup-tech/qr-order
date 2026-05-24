import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
  LandingSectionLabel,
} from "@/components/landing/landing-primitives";

const CARDS = [
  {
    badge: "✓ Konform",
    title: "KassenSichV & TSE",
    description:
      "Jede Transaktion wird über eine zertifizierte TSE signiert. Belege und Prüfspur inklusive — finanzamtbereit.",
  },
  {
    badge: "🔒 Sicher",
    title: "DSGVO by Design",
    description:
      "Minimale Gästepersonendaten, EU-Hosting, Einwilligungsflows und datenschutzkonforme Sessions.",
  },
  {
    badge: "⚡ Skalierbar",
    title: "Multi-Standort",
    description:
      "Organisationen, Standorte, Zonen und Tische in einer Hierarchie. Rollenbasierter Zugang für Besitzer, Manager, Service und Küche.",
  },
] as const;

const ARCH = [
  { value: "Multi-location", label: "Native Org & Venue Model" },
  { value: "Stripe Connect", label: "Per-Venue Payouts & PCI" },
  { value: "Real-time", label: "Live Orders, Tische & Calls" },
  { value: "CSV + DATEV", label: "Finance-ready Reporting" },
] as const;

export function LandingEnterpriseHome() {
  return (
    <section
      id="enterprise"
      className="scroll-mt-24 border-y border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] py-16 md:py-24"
    >
      <LandingContainer>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingSectionLabel>Enterprise</LandingSectionLabel>
          <LandingHeadline className="mt-4">
            Infrastruktur für Gruppen und Ketten.
          </LandingHeadline>
          <LandingLead className="mt-4">
            Multi-Standort, Rollenmodell, Stripe Connect pro Venue, und strukturiertes
            Rollout — nicht ein Einzelplatz-Tool mit Spreadsheets skaliert.
          </LandingLead>
        </AnimateInView>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {CARDS.map((card) => (
            <AnimateInView key={card.title}>
              <div className="h-full rounded-2xl border border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] p-7">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,158,11,0.12)] bg-[var(--lp-accent-soft)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--lp-accent)]">
                  {card.badge}
                </span>
                <h3 className="mt-4 text-[18px] font-semibold text-[var(--lp-ink)]">
                  {card.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.7] text-[var(--lp-muted)]">
                  {card.description}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 border-t border-[var(--lp-border-subtle)] pt-12 md:grid-cols-4">
          {ARCH.map((item) => (
            <AnimateInView key={item.value} className="text-center">
              <p className="text-[14px] font-semibold text-[var(--lp-accent)]">
                {item.value}
              </p>
              <p className="mt-1 text-[13px] text-[var(--lp-subtle)]">{item.label}</p>
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
