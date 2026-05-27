import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";

/** Experiment toggles — merged onto location config for counterfactual replay (M20). */
export type VenueSimExperimentOverrides = {
  orderingFlow?: ConciergeConfig["ordering"]["flow"];
  foodAfterDrinks?: boolean;
  maxUpsellsPerSession?: number;
  rushSkipUpsell?: boolean;
  playbookVariant?: ConciergeConfig["experiments"]["playbookVariant"];
};

export type VenueSimPlanSnapshot = {
  topGoal: string | null;
  flowNodeId: FlowNodeId;
  nextFlowNodeId: FlowNodeId;
  hasConflict: boolean;
  usedT0: boolean;
  intent: string | null;
  skillIds: string[];
  upsellGoal: boolean;
};

export type VenueSimTurnDelta = {
  traceId: string;
  guestText: string;
  flowNodeId: FlowNodeId;
  baseline: VenueSimPlanSnapshot;
  counterfactual: VenueSimPlanSnapshot;
  plannerChanged: boolean;
};

export type VenueSimMetrics = {
  turnCount: number;
  t0Hits: number;
  upsellGoals: number;
  conflictTurns: number;
  upsellFlowTransitions: number;
  plannerChangedTurns: number;
};

export type VenueSimReport = {
  sessionId: string;
  baselineLabel: string;
  counterfactualLabel: string;
  turns: VenueSimTurnDelta[];
  metrics: {
    baseline: VenueSimMetrics;
    counterfactual: VenueSimMetrics;
    delta: {
      upsellGoals: number;
      conflictTurns: number;
      upsellFlowTransitions: number;
      plannerChangedTurns: number;
    };
  };
};
