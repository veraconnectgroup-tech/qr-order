import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const steps = [
  {
    num: "1",
    title: "Registrieren & Speisekarte anlegen",
    desc:
      "Konto erstellen, Speisekarte mit Kategorien, Modifikatoren und Fotos hochladen.",
  },
  {
    num: "2",
    title: "QR-Codes für Tische drucken",
    desc: "QR-Codes generieren und drucken. Jeder Tisch bekommt seinen eigenen Code.",
  },
  {
    num: "3",
    title: "Gäste scannen, bestellen, bezahlen",
    desc:
      "Kein App-Download. Gäste browsen, bestellen und bezahlen vom Handy.",
  },
];

export function LandingWorkflows() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>In drei Schritten live</LandingHeadline>
          <LandingLead inverted className="mt-4">
            Von der Anmeldung zur ersten Gästebestellung in unter zwei Minuten.
          </LandingLead>
        </AnimateInView>

        <div className="relative mt-14 flex flex-col items-start gap-10 md:flex-row md:items-start md:gap-0">
          <div
            aria-hidden
            className="pointer-events-none absolute top-5 right-[16.7%] left-[16.7%] hidden h-0.5 bg-zinc-700 md:block"
          />

          {steps.map((s) => (
            <div
              key={s.num}
              className={cn(
                "relative flex flex-1 flex-col items-center px-4 text-center"
              )}
            >
              <div className="z-10 flex size-10 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white">
                {s.num}
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
