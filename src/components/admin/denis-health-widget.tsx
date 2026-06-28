import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { AutoAction } from "@/lib/denis/monitoring";
import type { DenisHealthSnapshot } from "@/lib/admin/load-denis-health-snapshot";

type Props = {
  snapshot: DenisHealthSnapshot;
};

const STATUS_LABEL: Record<
  DenisHealthSnapshot["evaluation"]["status"],
  { emoji: string; label: string; className: string }
> = {
  healthy: {
    emoji: "🟢",
    label: "Healthy",
    className: "text-emerald-400",
  },
  degraded: {
    emoji: "🟡",
    label: "Degraded",
    className: "text-amber-400",
  },
  critical: {
    emoji: "🔴",
    label: "Critical",
    className: "text-red-400",
  },
};

const DEGRADATION_LABEL: Record<
  DenisHealthSnapshot["degradationLevel"],
  { emoji: string; label: string; className: string }
> = {
  full: { emoji: "🟢", label: "Full", className: "text-emerald-400" },
  reduced: { emoji: "🟡", label: "Reduced", className: "text-amber-400" },
  essential: { emoji: "🟠", label: "Essential", className: "text-orange-400" },
  fallback: { emoji: "🔴", label: "Fallback (T0)", className: "text-red-400" },
  offline: { emoji: "⚫", label: "Offline", className: "text-zinc-400" },
};

export function DenisHealthWidget({ snapshot }: Props) {
  const { metrics, evaluation, metricsSource } = snapshot;
  const statusUi = STATUS_LABEL[evaluation.status];
  const degradationUi = DEGRADATION_LABEL[snapshot.degradationLevel];
  const t0Pct = Math.round(metrics.t0HitRate * 100);

  return (
    <QrCard>
      <QrCardTitle>Denis zdravlje</QrCardTitle>
      <QrCardDescription>
        Samopromatranje u realnom vremenu — bez LLM troška.
        {metricsSource === "empty" ? (
          <span className="ml-1 text-amber-400/90">
            (Nema live uzoraka — prikaz je prazan dok Denis ne obradi turnove.)
          </span>
        ) : null}
      </QrCardDescription>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className={`text-lg font-semibold ${statusUi.className}`}>
          {statusUi.emoji} {statusUi.label}
        </p>
        <p className={`text-sm font-medium ${degradationUi.className}`}>
          {degradationUi.emoji} Degradation: {degradationUi.label}
        </p>
        <p className="text-sm text-muted-foreground">
          Uptime {metrics.uptimePercent}% · Avg {formatMs(metrics.avgResponseMs)} ·
          T0 hit {t0Pct}%
        </p>
      </div>

      {snapshot.degradationStaffMessage && snapshot.degradationLevel !== "full" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Staff: {snapshot.degradationStaffMessage}
          {snapshot.degradationReason ? (
            <span className="block text-xs opacity-80">
              {snapshot.degradationReason}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Credit burn"
          value={`${metrics.creditBurnRatePerHour}/h`}
        />
        <Metric label="Aktivne sesije" value={metrics.activeSessionCount} />
        <Metric label="Loop detekcije" value={metrics.loopDetectionCount} />
        <Metric
          label="Stuck sesije"
          value={metrics.stuckSessions.length}
          warn={metrics.stuckSessions.length > 0}
        />
        <Metric label="P95 odgovor" value={formatMs(metrics.p95ResponseMs)} />
        <Metric
          label="Refusal rate"
          value={`${(metrics.refusalRate * 100).toFixed(1)}%`}
          warn={metrics.refusalRate > 0.01}
        />
        <Metric
          label="LLM error rate"
          value={`${(metrics.llmErrorRate * 100).toFixed(1)}%`}
          warn={metrics.llmErrorRate > 0.05}
        />
        <Metric label="Feature level" value={snapshot.featureLevel} />
        <Metric label="Degradation" value={snapshot.degradationLevel} />
      </div>

      {evaluation.issues.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Aktivni problemi
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground/90">
            {evaluation.issues.map((issue) => (
              <li key={issue}>· {issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.autoActions.length > 0 && evaluation.status !== "healthy" ? (
        <div className="mt-3 text-xs text-muted-foreground">
          Auto:{" "}
          {evaluation.autoActions
            .map((action: AutoAction) => {
              if (action.type === "staff_alert") return action.message;
              if (action.type === "t0_only") return "T0-only fallback";
              if (action.type === "skip_upsell") return "skip upsell";
              if (action.type === "reduce_proactive_frequency")
                return "reduce proactive";
              if (action.type === "owner_email") return "owner alert";
              if (action.type === "gradual_feature_restore")
                return "gradual restore";
              return "unknown";
            })
            .join(" · ")}
        </div>
      ) : null}
    </QrCard>
  );
}

function Metric({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          warn ? "text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
