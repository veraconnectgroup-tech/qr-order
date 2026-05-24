import { LandingContainer } from "@/components/landing/landing-primitives";
import { TrustLogoList } from "@/components/landing/trust-logos";

export function LandingTrustStrip() {
  return (
    <section
      aria-label="Integrationen und Zertifizierungen"
      className="border-y border-[#1e1e2e] bg-[#08080c]/90 py-6"
    >
      <LandingContainer wide>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Integrations &amp; Zertifizierungen
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
