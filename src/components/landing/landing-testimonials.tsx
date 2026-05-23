import { AnimateInView, StaggerInView, StaggerItem } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";

const testimonials = [
  {
    quote:
      "Finally an ordering system that understands German tax rules.",
  },
  {
    quote: "Setup took 20 minutes. Staff needed zero training.",
  },
  {
    quote: "Our guests love not having to wait for the waiter.",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-20 text-white sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingEyebrow inverted>Feedback</LandingEyebrow>
          <LandingHeadline inverted className="mt-3">
            Early operators, real workflows
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            Anonymized feedback from hospitality teams testing QR Order in
            production.
          </LandingLead>
        </AnimateInView>

        <StaggerInView className="mt-14 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerItem
              key={t.quote}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
            >
              <p className="flex-1 text-[15px] leading-relaxed text-zinc-300">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p className="mt-6 border-t border-zinc-800 pt-5 text-[12px] font-medium uppercase tracking-wider text-zinc-500">
                Early adopter feedback
              </p>
            </StaggerItem>
          ))}
        </StaggerInView>
      </LandingContainer>
    </section>
  );
}
