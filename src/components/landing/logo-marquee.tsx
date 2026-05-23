import { LandingContainer } from "@/components/landing/landing-primitives";

const operators = [
  "Skyline Lounge",
  "Harbor Group",
  "Altstadt Bars",
  "Rooftop Collective",
  "Nord Hospitality",
  "The Copper Room",
];

export function LogoMarquee() {
  const track = [...operators, ...operators];

  return (
    <section className="border-b border-[var(--lp-border)] bg-[var(--lp-tint)] py-5">
      <LandingContainer wide>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--lp-subtle)]">
          Used by hospitality operators across Europe
        </p>
      </LandingContainer>
      <div className="landing-marquee-mask relative mt-4 overflow-hidden">
        <ul className="landing-marquee-track flex w-max gap-10 px-6">
          {track.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="shrink-0 text-[14px] font-medium tracking-[-0.01em] text-[var(--lp-muted)]"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
