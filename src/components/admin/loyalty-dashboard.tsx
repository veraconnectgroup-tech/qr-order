import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import {
  GUEST_LEVELS,
  type LoyaltyDashboardStats,
} from "@/lib/denis/commerce/loyalty";

type Props = {
  stats: LoyaltyDashboardStats;
};

export function LoyaltyDashboard({ stats }: Props) {
  return (
    <div className="space-y-6">
      <QrCard>
        <QrCardTitle>Guest Loyalty Overview</QrCardTitle>
        <QrCardDescription>
          Nivoi, retention i ROI loyalty programa.
        </QrCardDescription>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ukupno gostiju" value={stats.totalGuests} />
          <Metric label="Retention rate" value={`${stats.retentionRate}%`} />
          <Metric label="Bodova izdato" value={stats.pointsIssued.toLocaleString("sr-RS")} />
          <Metric label="ROI multiplier" value={`${stats.loyaltySpendMultiplier}×`} />
        </div>
      </QrCard>

      <QrCard>
        <QrCardTitle>Gosti po nivou</QrCardTitle>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {GUEST_LEVELS.map((level) => (
            <div
              key={level.id}
              className="rounded-lg border border-border/60 bg-card/40 px-3 py-2"
            >
              <p className="text-xs text-muted-foreground">
                {level.badge} {level.name}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {stats.byLevel[level.id] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </QrCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopGuestsCard title="Top po posetama" rows={stats.topByVisits} metric="visits" />
        <TopGuestsCard title="Top po potrošnji" rows={stats.topBySpend} metric="spend" />
      </div>

      <QrCard>
        <QrCardTitle>Nagrade po nivou</QrCardTitle>
        <ul className="mt-4 space-y-3">
          {GUEST_LEVELS.filter((l) => l.id > 1).map((level) => (
            <li key={level.id} className="text-sm">
              <span className="font-medium">
                {level.badge} {level.name}:
              </span>{" "}
              <span className="text-muted-foreground">{level.perks.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </QrCard>
    </div>
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

function TopGuestsCard({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: LoyaltyDashboardStats["topByVisits"];
  metric: "visits" | "spend";
}) {
  return (
    <QrCard>
      <QrCardTitle>{title}</QrCardTitle>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nema podataka.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.guestToken}
              className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">#{index + 1}</span>
              <span className="font-mono text-xs">{row.guestToken.slice(0, 8)}…</span>
              <span className="font-medium tabular-nums">
                {metric === "visits"
                  ? `${row.visitCount} poseta`
                  : `€${row.totalSpent.toFixed(0)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}
