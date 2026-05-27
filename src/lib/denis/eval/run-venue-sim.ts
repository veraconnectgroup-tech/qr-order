import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  applyVenueSimOverrides,
  describeVenueSimOverrides,
} from "@/lib/denis/eval/apply-venue-sim-overrides";
import { extractTimelineReplayTurns } from "@/lib/denis/eval/extract-timeline-turns";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type {
  VenueSimExperimentOverrides,
  VenueSimMetrics,
  VenueSimPlanSnapshot,
  VenueSimReport,
  VenueSimTurnDelta,
} from "@/lib/denis/eval/venue-sim-types";

function snapshotFromReflex(
  reflexTurn: ReturnType<typeof planTurnWithReflex>
): VenueSimPlanSnapshot {
  const goals = reflexTurn.plan.goals;
  return {
    topGoal: reflexTurn.plan.topGoal?.type ?? null,
    flowNodeId: reflexTurn.plan.transition.fromNodeId,
    nextFlowNodeId: reflexTurn.plan.transition.toNodeId,
    hasConflict: reflexTurn.conflict?.hasConflict ?? false,
    usedT0: reflexTurn.usedT0,
    intent: reflexTurn.reflex?.intent ?? null,
    skillIds: reflexTurn.plan.skills.map((skill) => skill.id),
    upsellGoal: goals.some((goal) => goal.type === "UPSELL_ONCE"),
  };
}

function foodUpsellAskedBeforeSeq(
  events: DenisTimelineRow[],
  beforeSeq: number
): boolean {
  const partial = events.filter((event) => event.seq < beforeSeq);
  const flow = foldFlowProjection(partial);
  return (
    flow.currentNodeId === "upsell_food" || flow.previousNodeId === "upsell_food"
  );
}

function accumulateMetrics(
  snapshots: VenueSimPlanSnapshot[]
): VenueSimMetrics {
  let upsellFlowTransitions = 0;

  for (const snap of snapshots) {
    if (snap.nextFlowNodeId === "upsell_food") upsellFlowTransitions += 1;
  }

  return {
    turnCount: snapshots.length,
    t0Hits: snapshots.filter((snap) => snap.usedT0).length,
    upsellGoals: snapshots.filter((snap) => snap.upsellGoal).length,
    conflictTurns: snapshots.filter((snap) => snap.hasConflict).length,
    upsellFlowTransitions,
    plannerChangedTurns: 0,
  };
}

function plannerChanged(
  baseline: VenueSimPlanSnapshot,
  counterfactual: VenueSimPlanSnapshot
): boolean {
  if (baseline.topGoal !== counterfactual.topGoal) return true;
  if (baseline.nextFlowNodeId !== counterfactual.nextFlowNodeId) return true;
  if (baseline.hasConflict !== counterfactual.hasConflict) return true;
  if (baseline.skillIds.join(",") !== counterfactual.skillIds.join(",")) {
    return true;
  }
  return false;
}

function planTurnForSim(
  config: ConciergeConfig,
  input: {
    message: string;
    flowNodeId: FlowNodeId;
    foodUpsellAsked: boolean;
    skipUpsell: boolean;
  }
) {
  return planTurnWithReflex({
    config,
    message: input.message,
    flowNodeId: input.flowNodeId,
    cartState: emptyCartState(),
    foodUpsellAsked: input.foodUpsellAsked,
    skipUpsell: input.skipUpsell,
  });
}

/**
 * M20 — deterministic counterfactual replay: re-run kernel planner per timeline
 * turn with baseline vs experiment config (no LLM, no guest writes).
 */
export function runVenueSim(
  sessionId: string,
  events: DenisTimelineRow[],
  baselineConfig: ConciergeConfig,
  overrides: VenueSimExperimentOverrides
): VenueSimReport {
  const counterfactualConfig = applyVenueSimOverrides(baselineConfig, overrides);
  const turns = extractTimelineReplayTurns(events);
  const deltas: VenueSimTurnDelta[] = [];

  const baselineSnapshots: VenueSimPlanSnapshot[] = [];
  const counterfactualSnapshots: VenueSimPlanSnapshot[] = [];

  for (const turn of turns) {
    const foodUpsellAsked = foodUpsellAskedBeforeSeq(events, turn.firstSeq);
    const skipBaseline = false;
    const skipCounterfactual = counterfactualConfig.ops.rushSkipUpsell;

    const baselineReflex = planTurnForSim(baselineConfig, {
      message: turn.guestText,
      flowNodeId: turn.flowNodeId,
      foodUpsellAsked,
      skipUpsell: skipBaseline,
    });
    const counterfactualReflex = planTurnForSim(counterfactualConfig, {
      message: turn.guestText,
      flowNodeId: turn.flowNodeId,
      foodUpsellAsked,
      skipUpsell: skipCounterfactual,
    });

    const baseline = snapshotFromReflex(baselineReflex);
    const counterfactual = snapshotFromReflex(counterfactualReflex);
    baselineSnapshots.push(baseline);
    counterfactualSnapshots.push(counterfactual);

    const changed = plannerChanged(baseline, counterfactual);
    deltas.push({
      traceId: turn.traceId,
      guestText: turn.guestText,
      flowNodeId: turn.flowNodeId,
      baseline,
      counterfactual,
      plannerChanged: changed,
    });
  }

  const baselineMetrics = accumulateMetrics(baselineSnapshots);
  const counterfactualMetrics = accumulateMetrics(counterfactualSnapshots);
  baselineMetrics.plannerChangedTurns = 0;
  counterfactualMetrics.plannerChangedTurns = deltas.filter(
    (row) => row.plannerChanged
  ).length;

  return {
    sessionId,
    baselineLabel: `rollout=${baselineConfig.rollout.mode}`,
    counterfactualLabel: describeVenueSimOverrides(overrides),
    turns: deltas,
    metrics: {
      baseline: baselineMetrics,
      counterfactual: counterfactualMetrics,
      delta: {
        upsellGoals:
          counterfactualMetrics.upsellGoals - baselineMetrics.upsellGoals,
        conflictTurns:
          counterfactualMetrics.conflictTurns - baselineMetrics.conflictTurns,
        upsellFlowTransitions:
          counterfactualMetrics.upsellFlowTransitions -
          baselineMetrics.upsellFlowTransitions,
        plannerChangedTurns: counterfactualMetrics.plannerChangedTurns,
      },
    },
  };
}
