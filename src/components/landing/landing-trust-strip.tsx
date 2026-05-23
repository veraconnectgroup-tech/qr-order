import { LandingContainer } from "@/components/landing/landing-primitives";
import { TrustLogoList } from "@/components/landing/trust-logos";

export function LandingTrustStrip() {
  return (
    <section
      aria-label="Integrations and compliance"
      className="border-y border-zinc-800 bg-zinc-950/90 py-6"
    >
      <LandingContainer wide>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Integrations &amp; compliance
        </p>

        {/* Mobile: horizontal scroll — avoids squashing wide payment marks */}
        <ul className="mt-5 flex gap-3 overflow-x-auto pb-1 md:hidden">
          <TrustLogoList />
        </ul>

        {/* Desktop: flex wrap center */}
        <ul className="mt-5 hidden flex-wrap items-center justify-center gap-3 md:flex">
          <TrustLogoList />
        </ul>
      </LandingContainer>
    </section>
  );
}
