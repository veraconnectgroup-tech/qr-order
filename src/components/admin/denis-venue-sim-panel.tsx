"use client";

import { useState, useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { runVenueSimForSession } from "@/lib/admin/denis-venue-sim";
import type { DenisDebugSessionRow } from "@/lib/admin/denis-debug";
import type { VenueSimReport } from "@/lib/denis/eval/venue-sim-types";
import { Button } from "@/components/ui/button";

export function DenisVenueSimPanel({
  sessions,
  defaultFoodAfterDrinks,
  defaultRushSkipUpsell,
}: {
  sessions: DenisDebugSessionRow[];
  defaultFoodAfterDrinks: boolean;
  defaultRushSkipUpsell: boolean;
}) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [foodAfterDrinks, setFoodAfterDrinks] = useState(!defaultFoodAfterDrinks);
  const [rushSkipUpsell, setRushSkipUpsell] = useState(defaultRushSkipUpsell);
  const [maxUpsells, setMaxUpsells] = useState(2);
  const [report, setReport] = useState<VenueSimReport | null>(null);
  const [pending, startTransition] = useTransition();

  function runSim() {
    if (!sessionId) {
      toast.error("Select a session first.");
      return;
    }

    startTransition(async () => {
      const result = await runVenueSimForSession({
        sessionId,
        overrides: {
          foodAfterDrinks,
          rushSkipUpsell,
          maxUpsellsPerSession: maxUpsells,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        setReport(null);
        return;
      }

      setReport(result.report);
      toast.success("Simulation complete — planner-only replay.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold">Venue Sim</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Counterfactual kernel replay on a recorded timeline — compare upsell,
            conflict, and flow deltas before changing live config (M20).
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-neutral-700">AI session</span>
          <select
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            {sessions.length === 0 ? (
              <option value="">No sessions</option>
            ) : (
              sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.tableName ?? session.tableId.slice(0, 8)} ·{" "}
                  {session.timelineEventCount} events
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={foodAfterDrinks}
            onChange={(e) => setFoodAfterDrinks(e.target.checked)}
          />
          <span>upsell.foodAfterDrinks</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rushSkipUpsell}
            onChange={(e) => setRushSkipUpsell(e.target.checked)}
          />
          <span>ops.rushSkipUpsell (simulated rush)</span>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-neutral-700">
            upsell.maxUpsellsPerSession
          </span>
          <input
            type="number"
            min={0}
            max={10}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            value={maxUpsells}
            onChange={(e) => setMaxUpsells(Number(e.target.value))}
          />
        </label>
      </div>

      <Button type="button" disabled={pending || !sessionId} onClick={runSim}>
        {pending ? "Running…" : "Run counterfactual sim"}
      </Button>

      {report ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Upsell goals"
              baseline={report.metrics.baseline.upsellGoals}
              counterfactual={report.metrics.counterfactual.upsellGoals}
              delta={report.metrics.delta.upsellGoals}
            />
            <MetricCard
              title="Conflict turns"
              baseline={report.metrics.baseline.conflictTurns}
              counterfactual={report.metrics.counterfactual.conflictTurns}
              delta={report.metrics.delta.conflictTurns}
            />
            <MetricCard
              title="Planner changed"
              baseline={0}
              counterfactual={report.metrics.counterfactual.plannerChangedTurns}
              delta={report.metrics.delta.plannerChangedTurns}
            />
          </div>

          <p className="text-xs text-neutral-500">
            Baseline: {report.baselineLabel} · Counterfactual:{" "}
            {report.counterfactualLabel}
          </p>

          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Guest</th>
                  <th className="px-3 py-2">Baseline goal</th>
                  <th className="px-3 py-2">Sim goal</th>
                  <th className="px-3 py-2">Δ flow</th>
                </tr>
              </thead>
              <tbody>
                {report.turns.map((turn) => (
                  <tr
                    key={turn.traceId}
                    className={
                      turn.plannerChanged
                        ? "border-t border-amber-100 bg-amber-50/50"
                        : "border-t border-neutral-100"
                    }
                  >
                    <td className="max-w-[12rem] truncate px-3 py-2">
                      {turn.guestText}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {turn.baseline.topGoal ?? "—"} → {turn.baseline.nextFlowNodeId}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {turn.counterfactual.topGoal ?? "—"} →{" "}
                      {turn.counterfactual.nextFlowNodeId}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {turn.plannerChanged ? "changed" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  baseline,
  counterfactual,
  delta,
}: {
  title: string;
  baseline: number;
  counterfactual: number;
  delta: number;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <div className="mt-1 text-lg font-semibold text-neutral-900">
        {baseline} → {counterfactual}
      </div>
      <div
        className={
          delta === 0
            ? "text-xs text-neutral-500"
            : delta > 0
              ? "text-xs text-amber-700"
              : "text-xs text-emerald-700"
        }
      >
        Δ {delta > 0 ? `+${delta}` : delta}
      </div>
    </div>
  );
}
