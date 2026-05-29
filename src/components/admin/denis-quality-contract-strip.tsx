import type { DenisQualityContractStripData } from "@/lib/admin/denis-quality-contract";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MetricRow(props: {
  label: string;
  value: string;
  target: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{props.label}</p>
        <p className="text-xs text-muted-foreground">Target: {props.target}</p>
      </div>
      <span
        className={
          props.ok
            ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400"
            : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400"
        }
      >
        {props.value}
      </span>
    </div>
  );
}

type Props = {
  data: DenisQualityContractStripData;
};

/** ADR-031 C4 — eval-based quality contract strip for venue admin. */
export function DenisQualityContractStrip({ data }: Props) {
  const { contract, metrics } = data;
  const evalPass = Math.min(
    metrics.evalPassRate,
    metrics.pilotSrPassRate,
    metrics.waiterParityPassRate
  );

  return (
    <QrCard className="border-border/80 bg-card/80">
      <QrCardTitle>Denis Quality Contract</QrCardTitle>
      <QrCardDescription>
        Eval SLO gate (MR-7). Live LLM rate from last 24h timeline when Denis
        sessions exist.
      </QrCardDescription>

      <div className="mt-4 space-y-0">
        <MetricRow
          label="Eval pass (core + pilot + waiter parity)"
          value={pct(evalPass)}
          target={`≥ ${pct(contract.evalPassMin)}`}
          ok={evalPass >= contract.evalPassMin}
        />
        <MetricRow
          label="Refusal detector (fixture recall)"
          value={pct(metrics.refusalDetectionRate)}
          target="100%"
          ok={metrics.refusalDetectionRate >= 1}
        />
        <MetricRow
          label="Golden lines false refusal rate"
          value={pct(metrics.goldenRefusalRate)}
          target={`≤ ${pct(contract.refusalRateMax)}`}
          ok={metrics.goldenRefusalRate <= contract.refusalRateMax}
        />
        <MetricRow
          label="LLM invocation (waiter-parity sim — informational)"
          value={pct(metrics.simLlmInvocationRate)}
          target="sim only"
          ok
        />
        {data.liveTurnCount > 0 ? (
          <MetricRow
            label={`Live LLM rate (${data.liveTurnCount} turns / 24h)`}
            value={pct(data.liveLlmInvocationRate ?? 0)}
            target={`≤ ${pct(contract.llmInvocationMax)}`}
            ok={(data.liveLlmInvocationRate ?? 0) <= contract.llmInvocationMax}
          />
        ) : (
          <p className="py-2 text-xs text-muted-foreground">
            No Denis turn profiles in the last 24h — live LLM rate not gated.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={
            data.ok
              ? "text-sm font-medium text-emerald-400"
              : "text-sm font-medium text-amber-400"
          }
        >
          {data.ok ? "Contract PASS" : "Contract FAIL"}
        </span>
        <span className="text-xs text-muted-foreground">
          {metrics.scenarioCount} eval scenarios
        </span>
      </div>

      {!data.ok && data.violations.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-300/90">
          {data.violations.map((violation) => (
            <li key={violation}>{violation}</li>
          ))}
        </ul>
      ) : null}
    </QrCard>
  );
}
