import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { TurnPlanKind } from "@/lib/denis/cognition/tde/turn-plan-types";
import type {
  ConversationMode,
  ConversationAwaiting,
} from "@/lib/denis/cognition/beliefs/belief-types";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { SessionPhase } from "@/lib/scene/types";

export type WaiterParitySetup = {
  flowNodeId?: FlowNodeId;
  aiCartItems?: DenisCartLine[];
  lastAssistantMessage?: string | null;
  pendingSlot?: "serve_size" | "modifier" | "product" | "payment_method" | null;
  orders?: OrderFact[];
  billSettled?: boolean;
  operatingMode?: "normal" | "rush";
};

export type WaiterParityTurnExpect = {
  planKind?: TurnPlanKind;
  forbidPlanKinds?: TurnPlanKind[];
  requiresLlm?: boolean;
  reason?: string;
  conversationMode?: ConversationMode;
  conversationAwaiting?: ConversationAwaiting;
  commercePendingSlot?: string | null;
  usedT0?: boolean;
  /** C2 fuzzy normalize output when pending serve_size */
  fuzzyNormalized?: string;
  /** ADR-031 C1 — substrings that must appear in situation pack */
  situationIncludes?: string[];
};

export type WaiterParityTurn = {
  message: string;
  setup?: WaiterParitySetup;
  expect: WaiterParityTurnExpect;
  /** Simulate ACT / cart mutation after turn for next turn state */
  after?: {
    applyServeSize?: string;
  };
};

export type WaiterParityScenario = {
  id: string;
  description: string;
  sessionLanguage?: string;
  sessionPhase?: SessionPhase;
  baseSetup?: WaiterParitySetup;
  serveSizeOptions?: string[];
  turns: WaiterParityTurn[];
};

export type WaiterParityTurnResult = {
  turnIndex: number;
  message: string;
  passed: boolean;
  errors: string[];
  actual: {
    planKind: TurnPlanKind;
    requiresLlm: boolean;
    reason: string;
    conversationMode?: ConversationMode;
    conversationAwaiting?: ConversationAwaiting;
    commercePendingSlot?: string | null;
    usedT0: boolean;
    fuzzyNormalized?: string;
  };
};

export type WaiterParityScenarioResult = {
  scenarioId: string;
  passed: boolean;
  errors: string[];
  turns: WaiterParityTurnResult[];
};

export type WaiterParityReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  passRate: number;
  minPassRate: number;
  results: WaiterParityScenarioResult[];
};
