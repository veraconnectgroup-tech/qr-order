import { AnimateInView, StaggerInView, StaggerItem } from "@/components/landing/animate-in-view";
import { LandingContainer, LandingHeadline, LandingLead } from "@/components/landing/landing-primitives";

const testimonials = [
  {
    quote:
      "QR Order was the only platform that felt like operational software — not a menu PDF with payments attached.",
    name: "Director of Operations",
    venue: "Multi-concept group · 6 locations",
    feature: "Live orders",
    extension: "Kitchen display",
  },
  {
    quote:
      "We rolled out QR across 12 tables in an afternoon. Guests order faster and our hosts finally see session totals.",
    name: "General Manager",
    venue: "Skyline Lounge · Hamburg",
    feature: "Floor board",
    extension: "Session billing",
  },
  {
    quote:
      "Stripe Connect per venue made finance happy. Export-ready history without rebuilding reports in Excel.",
    name: "Finance lead",
    venue: "Harbor Group · 3 venues",
    feature: "Analytics",
    extension: "CSV export",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-20 text-white sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>Built for operators like you.</LandingHeadline>
          <LandingLead inverted className="mt-4">
            Used by hospitality teams running modern guest ordering and live
            operations.
          </LandingLead>
        </AnimateInView>

        <StaggerInView className="mt-14 grid gap-4 lg:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerItem
              key={t.name}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
            >
              <p className="flex-1 text-[15px] leading-relaxed text-zinc-300">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 border-t border-zinc-800 pt-5">
                <p className="text-[14px] font-medium text-white">{t.name}</p>
                <p className="mt-1 text-[13px] text-zinc-500">{t.venue}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                  <span>
                    Favorite:{" "}
                    <span className="text-zinc-300">{t.feature}</span>
                  </span>
                  <span>·</span>
                  <span>
                    Top module:{" "}
                    <span className="text-zinc-300">{t.extension}</span>
                  </span>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerInView>
      </LandingContainer>
    </section>
  );
}
