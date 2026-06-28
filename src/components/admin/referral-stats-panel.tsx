import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { ReferralDashboardStats } from "@/lib/denis/commerce/loyalty/referral-system";

type Props = {
  stats: ReferralDashboardStats;
};

export function ReferralStatsPanel({ stats }: Props) {
  return (
    <QrCard>
      <QrCardTitle>Referral program</QrCardTitle>
      <QrCardDescription>
        Gosti dovode goste — konverzija i prihod od preporuka.
      </QrCardDescription>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ukupno preporuka" value={stats.totalReferrals} />
        <Metric label="Konvertovano" value={stats.totalConverted} />
        <Metric label="Conversion rate" value={`${stats.overallConversionRate}%`} />
        <Metric
          label="Prihod od referral-a"
          value={`€${stats.totalRevenueEuros.toLocaleString("sr-RS", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
      </div>

      {stats.topReferrers.length > 0 ? (
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium">Top referrers</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="pb-2 pe-4 font-normal">Gost</th>
                  <th className="pb-2 pe-4 font-normal">Pozivi</th>
                  <th className="pb-2 pe-4 font-normal">Konverzije</th>
                  <th className="pb-2 pe-4 font-normal">Rate</th>
                  <th className="pb-2 font-normal">Prihod</th>
                </tr>
              </thead>
              <tbody>
                {stats.topReferrers.map((row) => (
                  <tr
                    key={row.referrerGuestToken}
                    className="border-b border-border/40"
                  >
                    <td className="py-2 pe-4 font-mono text-xs">
                      {row.referrerGuestToken.slice(0, 12)}…
                    </td>
                    <td className="py-2 pe-4 tabular-nums">{row.referralCount}</td>
                    <td className="py-2 pe-4 tabular-nums">{row.convertedCount}</td>
                    <td className="py-2 pe-4 tabular-nums">{row.conversionRate}%</td>
                    <td className="py-2 tabular-nums">
                      €{row.revenueEuros.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Još nema referral aktivnosti.
        </p>
      )}
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
