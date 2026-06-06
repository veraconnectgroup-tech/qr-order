import type { DenisSystemStatus } from "@/lib/admin/denis-system-status";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

function Row(props: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{props.label}</p>
        <p className="text-xs text-muted-foreground">{props.detail}</p>
      </div>
      <span
        className={
          props.ok
            ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400"
            : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400"
        }
      >
        {props.ok ? "OK" : "GAP"}
      </span>
    </div>
  );
}

export function DenisSystemStatusPanel({ status }: { status: DenisSystemStatus }) {
  return (
    <QrCard className="border-border/80 bg-card/80">
      <QrCardTitle>Denis system status</QrCardTitle>
      <QrCardDescription>
        Code vs guest reality. Full backlog:{" "}
        <code className="text-xs">docs/architecture/DENIS-FULL-IMPLEMENTATION-BACKLOG.md</code>
      </QrCardDescription>

      <div className="mt-4 space-y-0">
        <Row
          label="Pilot eval gate"
          ok={status.eval.pilotGateOk}
          detail={`core ${status.eval.corePass}/${status.eval.coreTotal} · waiter ${status.eval.waiterParityPass}/${status.eval.waiterParityTotal}`}
        />
        <Row
          label="Quality contract"
          ok={status.eval.qualityContractOk}
          detail="MR-7 eval SLO"
        />
        <Row
          label="Cognition code complete (C0–C5)"
          ok={status.gaps.codeCompleteCognition}
          detail="FSP + ACT + parity + contract + manifest gate"
        />
        <Row
          label="Guest sees new brain"
          ok={status.gaps.guestSeesNewBrain}
          detail={
            status.rollout
              ? `rollout=${status.rollout.mode} · narrate=${status.rollout.narrateWithLlm ? "on" : "off"} · legacy=${status.rollout.guestSeesLegacy ? "yes" : "no"}`
              : "rollout unknown"
          }
        />
        <Row
          label="Proactive in brain loop (Phase D)"
          ok={status.gaps.proactiveInLoop}
          detail="OPEN — see backlog Wave 3"
        />
        <Row
          label="Operator denis.* webhooks (I2)"
          ok={status.gaps.operatorWebhooks}
          detail="denis.session.* · metrics · alerts via outbox"
        />
      </div>

      {status.manifest ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Manifest v{status.manifest.activeVersion ?? "—"} · history{" "}
          {status.manifest.historyCount} versions
        </p>
      ) : null}
    </QrCard>
  );
}
