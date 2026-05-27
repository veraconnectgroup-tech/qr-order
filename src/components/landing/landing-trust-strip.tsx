import { TrustLogoList } from "@/components/landing/trust-logos";

/** System metadata rail — not a marketing logo strip. */
export function LandingTrustStrip() {
  return (
    <div
      aria-label="System integrations and compliance"
      className="border-b border-zinc-800/60 bg-[#08080c] px-6 py-3 lg:px-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[11px] text-zinc-600">
          Infrastructure · Stripe Connect · TSE · DATEV export
        </p>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 opacity-35">
          <TrustLogoList />
        </ul>
      </div>
    </div>
  );
}
