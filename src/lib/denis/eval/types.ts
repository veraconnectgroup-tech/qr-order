import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";

export type ScenarioExpectation = {
  topGoal?: string;
  hasConflict?: boolean;
  flowNodeId?: FlowNodeId;
  skillIds?: string[];
  usedT0?: boolean;
  intent?: string;
  allowR5?: boolean;
};

export type DenisEvalScenario = {
  id: string;
  description: string;
  message: string;
  flowNodeId?: FlowNodeId;
  aiCartItems?: DenisCartLine[];
  manualCartItems?: DenisCartLine[];
  foodUpsellAsked?: boolean;
  expect: ScenarioExpectation;
};

export type ScenarioRunResult = {
  scenarioId: string;
  passed: boolean;
  errors: string[];
  actual: {
    topGoal: string | null;
    hasConflict: boolean;
    flowNodeId: FlowNodeId;
    skillIds: string[];
    usedT0: boolean;
    intent: string | null;
  };
};

export type EvalSuiteReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  results: ScenarioRunResult[];
  shadowParityThreshold: number;
};
