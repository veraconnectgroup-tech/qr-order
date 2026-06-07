import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { NudgePerformanceSnapshot } from "@/lib/admin/load-nudge-performance";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

export function DenisNudgePerformancePanel({
  snapshot,
}: {
  snapshot: NudgePerformanceSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <QrCard>
        <QrCardTitle>Nudge performance</QrCardTitle>
        <QrCardDescription>
          Nema rollup podataka — pokreni migraciju 00120 i sačekaj Denis sesije.
        </QrCardDescription>
      </QrCard>
    );
  }

  const kindEntries = Object.entries(snapshot.byNudgeKind).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5 bg-dash-accent-muted ring-dash-border" />
        <div>
          <h2 className="text-lg font-semibold">Nudge performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Poslednjih {snapshot.periodDays} dana ({snapshot.fromDate} →{" "}
            {snapshot.toDate}) — ADR-039 outcome loop.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Prikazano" value={String(snapshot.nudgeImpressions)} />
        <Metric
          label="Prihvaćeno"
          value={`${snapshot.offerConversions} (${pct(snapshot.conversionRate)})`}
          accent
        />
        <Metric label="Odbijeno" value={String(snapshot.nudgeDeclined)} />
        <Metric
          label="Ignor / isteklo"
          value={`${snapshot.nudgeIgnored} / ${snapshot.nudgeExpired}`}
        />
      </div>

      {snapshot.suggestedAction ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          {snapshot.suggestedAction}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <QrCard className="p-0 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <QrCardTitle className="text-base">Po tipu nudge-a</QrCardTitle>
          </div>
          {kindEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nema podataka.</p>
          ) : (
            <ul className="divide-y divide-border">
              {kindEntries.map(([kind, count]) => (
                <li
                  key={kind}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="font-medium capitalize">{kindLabel(kind)}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </QrCard>

        <QrCard className="p-0 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <QrCardTitle className="text-base">Top proizvodi</QrCardTitle>
            <QrCardDescription className="mt-1">
              Koji proizvodi se najbolje prodaju kroz nudge-ove.
            </QrCardDescription>
          </div>
          {snapshot.topProducts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Još nema dovoljno nudge sesija.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Proizvod</th>
                    <th className="px-4 py-3 text-right">Accept</th>
                    <th className="px-4 py-3 text-right">Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.topProducts.map((row) => (
                    <tr key={row.productId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{row.productName}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                        {pct(row.acceptRate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.accepts}/{row.impressions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QrCard>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <QrCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-blue-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </QrCard>
  );
}
