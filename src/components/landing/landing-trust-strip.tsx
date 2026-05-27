import { TrustLogoList } from "@/components/landing/trust-logos";

/** Infrastructure metadata — quiet, not marketing. */
export function LandingTrustStrip() {
  return (
    <div
      aria-label="System integrations and compliance"
      className="border-b border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] px-6 py-3 lg:px-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="landing-meta font-mono">
          Stripe Connect · TSE · DATEV
        </p>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 opacity-30">
          <TrustLogoList />
        </ul>
      </div>
    </div>
  );
}
