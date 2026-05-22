const logos = [
  "Skyline Lounge",
  "Harbor Group",
  "Altstadt Bars",
  "Rooftop Collective",
  "Nord Hospitality",
  "The Copper Room",
  "Marina F&B",
];

export function LogoMarquee() {
  const track = [...logos, ...logos];

  return (
    <section className="border-b border-white/[0.06] py-11 sm:py-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600">
          Trusted by modern hospitality teams
        </p>
      </div>
      <div className="landing-marquee-mask relative mt-8 overflow-hidden">
        <div className="landing-marquee-track flex w-max gap-12 px-6 sm:gap-16">
          {track.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="shrink-0 text-sm font-medium tracking-tight text-zinc-600 sm:text-[15px]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
