"use client";

import { ChevronDown } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Ist Vera KassenSichV-konform?",
    a:
      "Ja. Jede Transaktion wird über eine " +
      "zertifizierte TSE signiert. " +
      "DATEV-Export inklusive.",
  },
  {
    q: "Brauchen Gäste eine App?",
    a:
      "Nein. Gäste scannen den QR-Code und " +
      "bestellen direkt im mobilen Browser. " +
      "Kein Download nötig.",
  },
  {
    q: "Wie funktioniert Split Bill?",
    a:
      "Gäste können nach Artikeln oder " +
      "gleichmäßig aufteilen. Jeder bezahlt " +
      "seinen Anteil separat.",
  },
  {
    q: "Was kostet Vera?",
    a:
      "0€ monatlich. Wir berechnen nur eine " +
      "kleine Gebühr pro Online-Kartenzahlung.",
  },
  {
    q: "Wie schnell kann ich starten?",
    a:
      "In unter 2 Minuten. Account erstellen, " +
      "Menü hochladen, QR-Codes drucken " +
      "— fertig.",
  },
  {
    q: "Kann ich Vera mit meinem Kassensystem verbinden?",
    a:
      "Ja. Vera unterstützt POS-Integrationen über Deliverect, Orderbird, Lightspeed und ready2order. Sprechen Sie uns an für Ihre Konfiguration.",
  },
];

export function LandingFaq() {
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] py-16 md:py-20"
    >
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-2xl text-center">
          <LandingHeadline>Häufige Fragen</LandingHeadline>
          <LandingLead className="mt-4">
            Antworten für Betreiber, die QR-Bestellung evaluieren.
          </LandingLead>
          <a
            href="mailto:kontakt@verait.de"
            className="mt-6 inline-block text-[14px] font-medium text-[var(--lp-accent)] hover:underline"
          >
            Team kontaktieren →
          </a>
        </AnimateInView>

        <div className="mx-auto mt-10 max-w-2xl">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group border-b border-[var(--lp-border-subtle)] py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <span className="text-left text-[15px] font-medium text-[var(--lp-ink)]">
                  {faq.q}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-5 shrink-0 text-[var(--lp-dim)] transition-transform duration-200",
                    "group-open:rotate-180"
                  )}
                />
              </summary>
              <p className="pt-3 text-sm leading-relaxed text-[var(--lp-muted)]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
