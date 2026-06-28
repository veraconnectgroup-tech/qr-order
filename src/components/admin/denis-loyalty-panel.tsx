import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { LoyaltyAdminSnapshot } from "@/lib/admin/load-loyalty-admin-snapshot";

type Props = {
  snapshot: LoyaltyAdminSnapshot;
};

export function DenisLoyaltyPanel({ snapshot }: Props) {
  const { stats, config } = snapshot;
  const tierLines = Object.entries(stats.byTier)
    .map(([tier, count]) => `${tier}: ${count}`)
    .join(" · ");

  return (
    <QrCard>
      <QrCardTitle>Loyalty program</QrCardTitle>
      <QrCardDescription>
        Opt-in nagradni program — {config.pointsPerCurrency} bod / {config.currencyUnit} RSD.
      </QrCardDescription>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ukupno članova" value={stats.totalMembers} />
        <Metric label="Bodova ovaj mjesec" value={stats.pointsIssuedThisMonth.toLocaleString("sr-RS")} />
        <Metric label="Nagrade iskorištene" value={stats.rewardsRedeemed} />
        <Metric
          label="ROI multiplier"
          value={`${stats.loyaltySpendMultiplier}×`}
        />
      </div>

      {tierLines ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Tier raspodjela: {tierLines}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        Prosječna redemption: {stats.avgRedemptionPoints} bodova
      </p>
    </QrCard>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
