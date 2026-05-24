import { ArrowDown } from "lucide-react";
import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/feature-visuals";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
} from "@/components/landing/landing-primitives";

const problems = [
  "4 verschiedene Tools für Bestellung, Küche, Zahlung, Buchhaltung",
  "Zettel gehen zwischen Theke und Küche verloren",
  "Gäste warten 10 Minuten nur um zu bezahlen",
];

const solutions = [
  "Ein Dashboard — vom QR-Scan bis zum DATEV-Export",
  "Echtzeit-Küchendisplay mit Soundbenachrichtigung",
  "Gäste bezahlen am Tisch in 15 Sekunden",
];

export function LandingPhilosophy() {
  return (
    <section className="border-b border-[#1e1e2e] bg-[#08080c] py-20 md:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingEyebrow inverted>Das Problem</LandingEyebrow>
          <LandingHeadline inverted className="mt-4">
            Gastronomie verdient bessere Software
          </LandingHeadline>
        </AnimateInView>

        <div className="relative mt-14 grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-6">
          <StaggerInView>
            <StaggerItem className="rounded-2xl border border-[#1e1e2e] bg-zinc-900/40 p-8 sm:p-10">
              <p className="font-display text-xl font-semibold tracking-[-0.02em] text-zinc-300 sm:text-2xl">
                Der Status Quo kostet Sie Geld.
              </p>
              <ul className="mt-6 space-y-3">
                {problems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[15px] leading-relaxed text-zinc-500"
                  >
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-[#5c5c72]"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </StaggerItem>
          </StaggerInView>

          <AnimateInView
            className="flex items-center justify-center py-2 lg:py-16"
            delay={0.1}
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_24px_rgba(99,102,241,0.2)]">
              <ArrowDown className="size-5 text-indigo-400 lg:rotate-[-90deg]" />
            </div>
          </AnimateInView>

          <StaggerInView>
            <StaggerItem className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] to-[#0f0f14] p-8 sm:p-10">
              <p className="font-display text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">
                Eine Plattform. Null Reibung.
              </p>
              <ul className="mt-6 space-y-3">
                {solutions.map((item) => (
                  <FeatureCheck key={item} accent>
                    {item}
                  </FeatureCheck>
                ))}
              </ul>
            </StaggerItem>
          </StaggerInView>
        </div>
      </LandingContainer>
    </section>
  );
}
