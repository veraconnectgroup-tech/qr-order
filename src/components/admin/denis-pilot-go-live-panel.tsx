"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  applyPilotGoLive,
  loadPilotCutoverAdminState,
  rollbackPilotCutover,
  type PilotCutoverAdminState,
} from "@/lib/admin/denis-pilot-cutover-actions";
import { pilotCutoverStageLabel } from "@/lib/denis/config/pilot-cutover-ladder";
import { Button } from "@/components/ui/button";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = {
  initial: PilotCutoverAdminState;
};

export function DenisPilotGoLivePanel({ initial }: Props) {
  const [state, setState] = useState(initial);
  const [staffAck, setStaffAck] = useState(
    initial.pilotCutover?.staffCopilotAcknowledged ?? false
  );
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const next = await loadPilotCutoverAdminState();
    if (!("error" in next)) {
      setState(next);
      setStaffAck(next.pilotCutover?.staffCopilotAcknowledged ?? staffAck);
    }
  }

  async function handleGoLive() {
    setBusy(true);
    const result = await applyPilotGoLive({ staffCopilotAcknowledged: staffAck });
    setBusy(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`Pilot advanced to ${result.label}`);
    await refresh();
  }

  async function handleRollback() {
    setBusy(true);
    const result = await rollbackPilotCutover();
    setBusy(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Pilot config rolled back");
    await refresh();
  }

  const nextLabel = state.nextStage
    ? pilotCutoverStageLabel(state.nextStage)
    : null;

  return (
    <QrCard className="max-w-2xl">
      <QrCardTitle>Pilot Go Live</QrCardTitle>
      <QrCardDescription>
        Table OS cutover ladder: Canary 10% → 50% → 100% → Denis only. One DB
        update per step; rollback restores the saved snapshot.
      </QrCardDescription>

      {state.envRolloutOverride ? (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Platform env{" "}
          <strong>DENIS_ROLLOUT_MODE={state.envRolloutOverride}</strong> blocks
          cutover until removed.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-border bg-muted p-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Current stage</dt>
          <dd className="font-medium">
            {state.currentStage
              ? pilotCutoverStageLabel(state.currentStage)
              : "Not started"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Next step</dt>
          <dd className="font-medium">{nextLabel ?? "Complete"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Eval pass</dt>
          <dd className="font-medium">{state.evalPassRatePct}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sessions</dt>
          <dd className="font-medium">{state.completedSessions}</dd>
        </div>
      </dl>

      <div
        className={`mt-4 rounded-md border p-3 ${
          state.ready
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-amber-500/30 bg-amber-500/5"
        }`}
      >
        <p className="text-sm font-medium text-foreground">
          Readiness {state.ready ? "— ready" : "— blockers remain"}
        </p>
        <ul className="mt-2 space-y-1.5">
          {state.checks.map((check) => (
            <li
              key={check.id}
              className={`text-xs ${
                check.passed
                  ? "text-emerald-300"
                  : check.blocking
                    ? "text-amber-200"
                    : "text-muted-foreground"
              }`}
            >
              {check.passed ? "✓" : check.blocking ? "!" : "·"} {check.label}
              {check.detail ? ` — ${check.detail}` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4 rounded-md border border-border p-3">
        <div>
          <Label htmlFor="staff-copilot-ack" className="text-sm font-medium">
            Staff copilot reviewed
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner confirms floor dashboard actions were reviewed before cutover.
          </p>
        </div>
        <Switch
          id="staff-copilot-ack"
          checked={staffAck}
          onCheckedChange={setStaffAck}
          aria-label="Staff copilot reviewed"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleGoLive}
          disabled={busy || !state.nextStage || !staffAck || Boolean(state.envRolloutOverride)}
        >
          {busy
            ? "Applying…"
            : nextLabel
              ? `Go Live — ${nextLabel}`
              : "Ladder complete"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleRollback}
          disabled={busy || !state.hasRollbackSnapshot}
        >
          Rollback snapshot
        </Button>
      </div>
    </QrCard>
  );
}
