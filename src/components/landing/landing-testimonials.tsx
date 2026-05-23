import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
} from "@/components/landing/landing-primitives";

const METRICS = [
  { value: "< 30s", label: "Average guest order time" },
  { value: "0€", label: "Monthly platform fee" },
  { value: "99.9%", label: "Uptime SLA target" },
  { value: "2 min", label: "Setup to first order" },
] as const;

export function LandingTestimonials() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>Built for real service</LandingHeadline>
        </AnimateInView>

        <StaggerInView className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {METRICS.map(({ value, label }) => (
            <StaggerItem
              key={label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center"
            >
              <p className="text-4xl font-bold text-orange-500 md:text-5xl">
                {value}
              </p>
              <p className="mt-2 text-sm text-zinc-400">{label}</p>
            </StaggerItem>
          ))}
        </StaggerInView>

        <AnimateInView className="mt-10 text-center text-sm text-zinc-500">
          Real operator feedback coming soon.
          <br />
          Request access to join our pilot program.
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
