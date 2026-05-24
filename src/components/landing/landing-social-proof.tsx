import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingContainer } from "@/components/landing/landing-primitives";

const VENUES = [
  "Skyline Lounge",
  "Hafen Brasserie",
  "Alsterblick",
  "NOMAD Kitchen",
  "Elbterrasse",
] as const;

const STATS = [
  { value: "50k+", label: "Bestellungen" },
  { value: "<15s", label: "Checkout-Zeit" },
  { value: "99.9%", label: "Uptime" },
] as const;

export function LandingSocialProof() {
  return (
    <section className="py-14 md:py-16">
      <LandingContainer>
        <AnimateInView className="text-center">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--lp-dim)]">
            Vertraut von Betreibern in ganz Deutschland
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-35">
            {VENUES.map((name) => (
              <span
                key={name}
                className="text-[18px] font-bold tracking-[-0.02em] text-[var(--lp-muted)]"
              >
                {name}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-12">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-[28px] font-bold text-[var(--lp-accent)]">{value}</p>
                <p className="mt-1 text-[13px] text-[var(--lp-subtle)]">{label}</p>
              </div>
            ))}
          </div>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
