"use client";

import { ChevronDown } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Ist QR Order KassenSichV-konform?",
    a: "Ja. Jede Transaktion wird über eine zertifizierte TSE signiert. DATEV-Export inklusive.",
  },
  {
    q: "Brauchen Gäste eine App?",
    a: "Nein. Gäste scannen den QR-Code und bestellen direkt im mobilen Browser. Kein Download nötig.",
  },
  {
    q: "Wie funktioniert Split Bill?",
    a: "Gäste können nach Artikeln oder gleichmäßig aufteilen. Jeder bezahlt seinen Anteil separat.",
  },
  {
    q: "Was kostet QR Order?",
    a: "0€ monatlich. Wir berechnen nur eine kleine Gebühr pro Online-Kartenzahlung.",
  },
  {
    q: "Wie schnell kann ich starten?",
    a: "In unter 2 Minuten. Account erstellen, Menü hochladen, QR-Codes drucken — fertig.",
  },
] as const;

export function LandingFaq() {
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20"
    >
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-2xl text-center">
          <LandingHeadline inverted>Häufige Fragen</LandingHeadline>
        </AnimateInView>

        <div className="mx-auto mt-10 max-w-2xl">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group border-b border-zinc-800 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <span className="text-left text-[15px] font-medium text-zinc-100">
                  {faq.q}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-5 shrink-0 text-zinc-500 transition-transform duration-200",
                    "group-open:rotate-180"
                  )}
                />
              </summary>
              <p className="pt-3 text-sm leading-relaxed text-zinc-400">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
