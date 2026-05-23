import { LandingContainer } from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const badges = [
  "🇩🇪 Made in Germany",
  "KassenSichV / TSE",
  "DSGVO konform",
  "DATEV Export",
  "Stripe Connect",
];

export function LandingTrustStrip() {
  return (
    <section
      aria-label="Platform trust signals"
      className="border-y border-zinc-800 bg-zinc-950/80"
    >
      <LandingContainer wide>
        <ul className="grid grid-cols-2 gap-3 py-5 md:flex md:flex-wrap md:items-center md:justify-center md:gap-1 md:py-5">
          {badges.map((badge, index) => (
            <li
              key={badge}
              className={cn(
                "flex items-center justify-center md:px-3",
                index === badges.length - 1 && "col-span-2 md:col-span-1"
              )}
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className="mr-3 hidden text-zinc-700 md:inline"
                >
                  •
                </span>
              )}
              <span className="text-center text-[12px] font-medium tracking-wide text-zinc-500 md:text-[13px]">
                {badge}
              </span>
            </li>
          ))}
        </ul>
      </LandingContainer>
    </section>
  );
}
