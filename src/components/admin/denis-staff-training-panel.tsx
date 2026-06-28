import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { StaffTrainingSnapshot } from "@/lib/admin/load-staff-training-insight";
import type { StaffLeaderboardMetric } from "@/lib/admin/staff-training-insights";

const LEADERBOARD_LABELS: Record<StaffLeaderboardMetric, string> = {
  fastest_response: "Najbrži odgovor",
  most_tips: "Najviše napojnica",
  best_rating: "Najbolja ocena",
};

function severityPrefix(severity: string): string {
  if (severity === "critical") return "🚨";
  if (severity === "action_needed") return "⚠️";
  return "ℹ️";
}

export function DenisStaffTrainingPanel({
  snapshot,
}: {
  snapshot: StaffTrainingSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <QrCard>
        <QrCardTitle>Staff training signals</QrCardTitle>
        <QrCardDescription>
          Nema podataka — Denis treba više sesija sa frustration, idle i allergy
          alertima.
        </QrCardDescription>
      </QrCard>
    );
  }

  const hasContent =
    snapshot.insights.length > 0 ||
    snapshot.staffPerformance.some((row) => row.recommendedAreas.length > 0) ||
    snapshot.recommendations.length > 0;

  if (!hasContent) {
    return (
      <QrCard>
        <QrCardTitle>Staff training signals</QrCardTitle>
        <QrCardDescription>
          {snapshot.fromDate} → {snapshot.toDate} · premalo podataka (minimum 20
          data points po oblasti).
        </QrCardDescription>
      </QrCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5 bg-dash-accent-muted ring-dash-border" />
        <div>
          <h2 className="text-lg font-semibold">Staff training signals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner-only operativni uvidi · {snapshot.fromDate} → {snapshot.toDate}
          </p>
        </div>
      </div>

      {snapshot.recommendations.length > 0 ? (
        <QrCard>
          <QrCardTitle className="text-base">Preporuke</QrCardTitle>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            {snapshot.recommendations.map((rec) => (
              <li key={`${rec.area}-${rec.message}`}>
                {severityPrefix(rec.severity)} {rec.message}
              </li>
            ))}
          </ul>
        </QrCard>
      ) : null}

      {snapshot.insights.length > 0 ? (
        <div className="grid gap-3">
          {snapshot.insights.slice(0, 5).map((insight) => (
            <QrCard key={`${insight.area}-${insight.title}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <QrCardTitle className="text-base">
                    {severityPrefix(insight.severity)}{" "}
                    {insight.area.toUpperCase()}
                  </QrCardTitle>
                  <p className="mt-2 text-sm text-foreground">{insight.title}</p>
                  <QrCardDescription className="mt-2">
                    {insight.detail}
                  </QrCardDescription>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {insight.dataPoints} pts
                </span>
              </div>
              <p className="mt-3 text-sm text-dash-accent">
                {insight.suggestedTraining}
              </p>
            </QrCard>
          ))}
        </div>
      ) : null}

      {snapshot.staffPerformance.length > 0 ? (
        <QrCard>
          <QrCardTitle className="text-base">Performans po osoblju</QrCardTitle>
          <div className="mt-3 space-y-3">
            {snapshot.staffPerformance.slice(0, 8).map((row) => (
              <div
                key={row.staffId}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {row.staffName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.orderCount} narudžbina · avg {row.avgResponseMinutes} min
                    odgovor · {row.complaintCount} complaints
                  </p>
                </div>
                <p
                  className={`text-xs ${
                    row.recommendedAreas.length > 0
                      ? "text-dash-accent"
                      : "text-muted-foreground"
                  }`}
                >
                  {row.summary}
                </p>
              </div>
            ))}
          </div>
        </QrCard>
      ) : null}

      {snapshot.leaderboard.length > 0 ? (
        <QrCard>
          <QrCardTitle className="text-base">Leaderboard (opt-in)</QrCardTitle>
          <QrCardDescription className="mt-1">
            Samo staff sa uključenim leaderboard opt-in u Denis config-u.
          </QrCardDescription>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {snapshot.leaderboard.map((entry) => (
              <div
                key={`${entry.metric}-${entry.staffId}`}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {LEADERBOARD_LABELS[entry.metric]}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {entry.staffName}
                </p>
                <p className="text-xs text-dash-accent">{entry.displayValue}</p>
              </div>
            ))}
          </div>
        </QrCard>
      ) : null}
    </div>
  );
}
