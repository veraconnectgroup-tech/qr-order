import { z } from "zod";

export const FlowSignalSchema = z.enum([
  "ORDER",
  "CLARIFY_REPLY",
  "CONFIRM",
  "DECLINE",
  "DONE",
  "BROWSE",
  "STATUS",
  "HANDOFF_WAITER",
  "HANDOFF_PAY",
  "SMALLTALK",
  "UNKNOWN",
  "DRAFT_DRINKS_ONLY",
  "DRAFT_HAS_FOOD",
  "SUCCESS",
  "FAIL",
  "PREORDER",
]);

export type FlowSignal = z.infer<typeof FlowSignalSchema>;

const FlowNodeSchema = z.object({
  on: z.record(z.string(), z.string()).optional(),
  skills: z.array(z.string()).optional(),
  guard: z.string().optional(),
  narrate: z.string().optional(),
});

export const FlowDefinitionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  entry: z.string(),
  nodes: z.record(z.string(), FlowNodeSchema),
});

export type FlowNode = z.infer<typeof FlowNodeSchema>;
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;

export type FlowNodeId = string;

export type FlowGuardContext = {
  foodAfterDrinksEnabled: boolean;
  foodUpsellAsked: boolean;
  cartItemCount: number;
  drinksOnly: boolean;
  hasFood: boolean;
  /** M13 — skip upsell_food when rush / KDS stress */
  skipUpsell?: boolean;
};

export type FlowTransitionResult = {
  fromNodeId: FlowNodeId;
  toNodeId: FlowNodeId;
  signal: FlowSignal;
  skippedGuard: boolean;
};

export type FlowNodePlan = {
  nodeId: FlowNodeId;
  skills: string[];
  narrateTemplate: string | null;
  guard: string | null;
};
