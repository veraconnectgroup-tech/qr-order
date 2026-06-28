import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { AbandonmentPreventionSnapshot } from "@/lib/admin/load-abandonment-prevention";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function DenisAbandonmentPreventionPanel({
  snapshot,
}: {
  snapshot: AbandonmentPreventionSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <QrCard>
        <QrCardTitle>Abandonment prevention</QrCardTitle>
        <QrCardDescription>
          Nema podataka — Denis prevention nudge-ovi se pojavljuju pre napuštanja korpe.
        </QrCardDescription>
      </QrCard>
    );
  }

  const kindEntries = Object.entries(snapshot.byKind).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Abandonment prevention</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Poslednjih {snapshot.periodDays} dana ({snapshot.fromDate} → {snapshot.toDate})
          — Denis sprečava napuštanje pre nego što se desi.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Prevention emitovano" value={String(snapshot.preventionEmitted)} />
        <Metric
          label="Konverzija posle"
          value={`${snapshot.preventionConverted} (${pct(snapshot.postInterventionConversionRate)})`}
          accent
        />
        <Metric label="Prevention rate" value={pct(snapshot.preventionRate)} />
        <Metric
          label="Ignor / odbijeno"
          value={`${snapshot.ignored} / ${snapshot.declined}`}
        />
      </div>

      <QrCard className="p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <QrCardTitle className="text-base">Po tipu intervencije</QrCardTitle>
          <QrCardDescription className="mt-1">
            price_shock · decision_paralysis · distraction_nudge
          </QrCardDescription>
        </div>
        {kindEntries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Još nema prevention nudge-ova.</p>
        ) : (
          <ul className="divide-y divide-border">
            {kindEntries.map(([kind, count]) => (
              <li
                key={kind}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">{kind.replace(/_/g, " ")}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </QrCard>
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
