import { LandingContainer } from "@/components/landing/landing-primitives";
import { TrustLogoList } from "@/components/landing/trust-logos";

export function LandingTrustStrip() {
  return (
    <section aria-label="Integrations and compliance" className="bg-black py-12 md:py-16">
      <LandingContainer wide>
        <p className="text-center text-[11px] tracking-[0.14em] text-zinc-600 uppercase">
          Integrations &amp; compliance
        </p>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 opacity-40 md:gap-x-8">
          <TrustLogoList />
        </ul>
      </LandingContainer>
    </section>
  );
}
