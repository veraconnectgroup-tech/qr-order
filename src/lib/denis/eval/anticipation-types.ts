import type { OrderFact } from "@/lib/denis/loop/types";
import type { SessionPhase } from "@/lib/scene/types";
import type { GuestProactiveNudge } from "@/lib/denis/runtime/evaluate-proactive-tick";
import type { TurnPlanKind } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { PendingSlotKind } from "@/lib/denis/cognition/beliefs/belief-types";
import type { MentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type AnticipationSetup = {
  sessionPhase: SessionPhase;
  orders?: OrderFact[];
  aiCartItems?: DenisCartLine[];
  pendingSlot?: PendingSlotKind | null;
  dismissedNudges?: string[];
  timeline?: DenisTimelineRow[];
  flowNodeId?: FlowNodeId;
  mentalModelMode?: MentalModelMode;
  operatingMode?: "normal" | "rush";
  skipUpsell?: boolean;
  proactiveEnabled?: boolean;
  pairingEnabled?: boolean;
  dessertEnabled?: boolean;
  slowKitchenEnabled?: boolean;
  orderDelayEnabled?: boolean;
  offerEnrich?: boolean;
};

export type AnticipationExpect = {
  emit: boolean;
  kind?: GuestProactiveNudge["kind"];
  skipReason?: string;
  planKind?: TurnPlanKind;
  requiresLlm?: boolean;
  messageIncludes?: string;
  messageForbidden?: string;
};

export type AnticipationScenario = {
  id: string;
  description: string;
  setup: AnticipationSetup;
  payload: {
    browseMinutes?: number;
    cartItemCount?: number;
    hasDrinkInCart?: boolean;
    dismissedNudgeKeys?: string[];
    popularityPair?: { from: string; to: string };
  };
  expect: AnticipationExpect;
};

export type AnticipationScenarioResult = {
  id: string;
  description: string;
  passed: boolean;
  errors: string[];
  actual: {
    emit: boolean;
    kind: GuestProactiveNudge["kind"] | null;
    skipReason: string | null;
    planKind: TurnPlanKind | null;
    requiresLlm: boolean | null;
    message: string | null;
  };
};

export type AnticipationReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  minPassRate: number;
  passRate: number;
  results: AnticipationScenarioResult[];
};
