import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { InterventionJournalSnapshot } from "@/lib/admin/load-intervention-journal-stats";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function DenisInterventionJournalPanel({
  snapshot,
}: {
  snapshot: InterventionJournalSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <QrCard>
        <QrCardTitle>Intervention journal</QrCardTitle>
        <QrCardDescription>
          Nema podataka — uključi IJS shadow mod i sačekaj Denis sesije.
        </QrCardDescription>
      </QrCard>
    );
  }

  const totalEvaluations =
    snapshot.evaluatedSpeak +
    snapshot.evaluatedSilence +
    snapshot.evaluatedDefer;

  const ruleEntries = Object.entries(snapshot.byRuleId).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5 bg-dash-accent-muted ring-dash-border" />
        <div>
          <h2 className="text-lg font-semibold">Intervention journal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            IJS {snapshot.mode} · manifest {snapshot.manifestVersion} ·{" "}
            {snapshot.fromDate} → {snapshot.toDate}
          </p>
          {!snapshot.journalActive ? (
            <p className="mt-2 text-sm text-amber-700">
              Journal je isključen — uključi{" "}
              <code className="rounded bg-muted/50 px-1">intervention.mode</code>{" "}
              shadow u Denis config-u.
            </p>
          ) : snapshot.configuredMode === "enforce" && snapshot.mode === "shadow" ? (
            <p className="mt-2 text-sm text-amber-700">
              Enforce je tražen ali nije spreman — ostaje shadow dok GMM enforce +
              offerEnrich nisu aktivni.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Speak" value={String(snapshot.evaluatedSpeak)} accent />
        <Metric label="Silence" value={String(snapshot.evaluatedSilence)} />
        <Metric label="Defer" value={String(snapshot.evaluatedDefer)} />
        <Metric
          label="Committed"
          value={String(snapshot.committed)}
          sub={
            snapshot.shadowAccuracy != null
              ? `Shadow ${pct(snapshot.shadowAccuracy)}`
              : undefined
          }
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
            <QrCardTitle className="text-base">Pravila (fired)</QrCardTitle>
          </div>
          {ruleEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {totalEvaluations === 0
                ? "Još nema evaluacija u ovom periodu."
                : "Nema ruleId u commerce eventima."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ruleEntries.map(([ruleId, count]) => (
                <li
                  key={ruleId}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="font-medium">{ruleId}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QrCard>

        <QrCard className="p-0 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <QrCardTitle className="text-base">Lifecycle</QrCardTitle>
          </div>
          <ul className="divide-y divide-border text-sm">
            <LifecycleRow label="Declined" value={snapshot.declined} />
            <LifecycleRow label="Expired" value={snapshot.expired} />
            <LifecycleRow label="Superseded" value={snapshot.superseded} />
          </ul>
        </QrCard>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <QrCard className="px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-dash-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </QrCard>
  );
}

function LifecycleRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <span>{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </li>
  );
}
