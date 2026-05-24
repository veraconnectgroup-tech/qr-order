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

const complianceProof = [
  {
    title: "KassenSichV",
    badge: "✓",
    badgeClass: "bg-indigo-500 text-white",
    description:
      "TSE-gestützte Transaktionssignierung für die deutsche Fiskalpflicht — Belege und Prüfspur inklusive.",
  },
  {
    title: "DSGVO",
    badge: "EU",
    badgeClass: "bg-indigo-500/80 text-white",
    description:
      "Minimale Gästepersonendaten by Design. EU-Hosting, Einwilligungsflows und datenschutzkonforme Sessions.",
  },
  {
    title: "DATEV-Export",
    badge: "↗",
    badgeClass: "bg-indigo-500/60 text-white",
    description:
      "Buchhaltungs-fertige CSV- und DATEV-kompatible Exporte — Kartenzahlungen ohne manuelle Nacharbeit.",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-t border-[#1e1e2e] bg-[#08080c] py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>Compliance ab Werk</LandingHeadline>
          <LandingLead inverted className="mt-4">
            Deutsche Gastronomiebetreiber brauchen mehr als hübsche Oberflächen
            — steuerliche und datenschutzrechtliche Anforderungen sind nicht
            verhandelbar.
          </LandingLead>
        </AnimateInView>

        <StaggerInView className="mt-14 grid gap-4 md:grid-cols-3">
          {complianceProof.map((item) => (
            <StaggerItem
              key={item.title}
              className="landing-glow-border rounded-2xl border border-[#1e1e2e] bg-zinc-900/50 p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${item.badgeClass}`}
                >
                  {item.badge}
                </span>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                {item.description}
              </p>
            </StaggerItem>
          ))}
        </StaggerInView>
      </LandingContainer>
    </section>
  );
}
