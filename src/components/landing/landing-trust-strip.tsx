import { LandingContainer } from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  { icon: "✓", label: "KassenSichV", amber: true },
  { icon: "🔒", label: "DSGVO", amber: true },
  { icon: "📊", label: "DATEV-Export", amber: true },
  { icon: "💳", label: "Stripe Connect", amber: false },
  { icon: "📱", label: "Apple & Google Pay", amber: false },
  { icon: "🇪🇺", label: "EU-Hosting", amber: false },
] as const;

function TrustItem({
  icon,
  label,
  amber,
}: {
  icon: string;
  label: string;
  amber: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 text-[13px] font-medium text-[var(--lp-subtle)]">
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border text-[14px]",
          amber
            ? "border-[rgba(245,158,11,0.15)] bg-[var(--lp-accent-soft)] text-[var(--lp-accent)]"
            : "border-[var(--lp-border-subtle)] bg-[var(--lp-surface)]"
        )}
      >
        {icon}
      </div>
      {label}
    </div>
  );
}

export function LandingTrustStrip() {
  return (
    <section
      aria-label="Integrationen und Zertifizierungen"
      className="border-y border-[var(--lp-border-subtle)] py-12"
    >
      <LandingContainer wide>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {TRUST_ITEMS.map((item) => (
            <TrustItem key={item.label} {...item} />
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
