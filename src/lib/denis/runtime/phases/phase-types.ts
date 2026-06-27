import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import type { TurnPlan, TurnPlanKind } from "@/lib/denis/cognition/tde";
import type { EvidencePointer } from "@/lib/denis/cognition/context/plan-evidence";
import type { RecoveryAction } from "@/lib/denis/cognition/recovery";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { ActHandoffOutcome } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import type { ActSubmitOutcome } from "@/lib/denis/runtime/act/resolve-act-submit-outcome";
import type { ActOrderChangeOutcome } from "@/lib/denis/runtime/act/resolve-act-order-change-outcome";
import type { OrderSlots } from "@/lib/denis/runtime/perceive/order-slots.schema";
import type {
  DenisChannel,
  DenisChatBody,
  DenisTurnContext,
  DenisTurnMeta,
  DenisTurnRunInput,
} from "@/lib/denis/runtime/turn-types";
import type { TurnPhaseTimings } from "@/lib/denis/runtime/turn-observability";
import type { LegacyChatSuccessData } from "@/lib/denis/surfaces/chat/format-turn-response";
import type { AiStructuredResponse } from "@/lib/ai/types";
import type { NarrationTier } from "@/lib/denis/runtime/narrate/narration-facts.schema";
import type { TurnAllergyContext } from "@/lib/denis/cognition/safety/resolve-turn-allergy-context";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter";
import type { DenisHealthEvaluation } from "@/lib/denis/monitoring";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ParsedTurnInput =
  | { ok: true; channel: "chat" | "voice"; data: DenisChatBody }
  | { ok: false; response: Response };

export type AuthenticatedTurn = {
  orgId: string;
  creditBalanceAfter: number;
};

export type PreparedTurnContext = {
  ctx: DenisTurnContext;
  chatAiSessionId: string | null;
  timelineAiSessionIdForHealth: string;
  healthEvaluation: DenisHealthEvaluation;
  healthStateTransition: Awaited<
    ReturnType<
      typeof import("@/lib/denis/monitoring").applyHealthStateTransition
    >
  >;
  degradationTransition: Awaited<
    ReturnType<
      typeof import("@/lib/denis/monitoring").applyDegradationTransition
    >
  >;
  contextMs: number;
};

export type TdePerceiveResult = {
  response: Response;
  turnPlan: TurnPlan;
  llmUsed: boolean;
  planKind: TurnPlanKind;
  tier: string;
  evidencePointers: EvidencePointer[];
  pendingSlotActResolved?: boolean;
  cartDraftFromAct?: DenisTurnContext["aiCartState"]["draft"];
  frustrationRecovery?: RecoveryAction[];
};

export type PerceiveChatPayload = {
  data?: {
    sessionId?: string;
    message?: string;
    intent?: string;
    recommendations?: Array<{ productName?: string; name?: string }>;
    cartActions?: Array<{ productName: string; quantity?: number }>;
    quickReplies?: string[];
    submitOrder?: boolean;
    creditsRemaining?: number;
    creditsCharged?: number;
    structuredPerception?: AiStructuredResponse;
  };
};

export type PerceiveTurnResult = {
  ctx: DenisTurnContext;
  perceiveResult: TdePerceiveResult;
  perceivePayload: PerceiveChatPayload;
  perceiveData: NonNullable<PerceiveChatPayload["data"]>;
  beliefGraph: BeliefGraph | null;
  reflexTurn: ReflexTurnResult;
  slotExtract: OrderSlots | null;
  timelineEnabled: boolean;
  rolloutMode: ConciergeRolloutMode;
  pendingSlot: string | null;
  aiSessionId: string | null;
  timelineAiSessionId: string | null;
  perceiveBody: DenisChatBody;
  profileTier: string;
  frustrationRecovery: RecoveryAction[];
  legacyMs: number;
};

export type ActOnTurnResult = {
  ctx: DenisTurnContext;
  perceiveData: NonNullable<PerceiveChatPayload["data"]>;
  cartDraftForAct: DenisCartDraft;
  actPhase: ActPhaseResult;
  actSubmitLive: boolean;
  actSubmitOutcome: ActSubmitOutcome;
  turnSubmitOutcome: ActSubmitOutcome;
  actHandoffOutcome: ActHandoffOutcome;
  actOrderChangeOutcome: ActOrderChangeOutcome;
  allergyCtx: TurnAllergyContext;
  waiterObligation: WaiterObligation;
  pendingSlotActApplied: boolean;
  actMs: number;
};

export type NarrationResult = {
  message: string;
  tier: NarrationTier | "legacy";
  lintPassed: boolean;
  usedFallback: boolean;
};

export type NarrateTurnResult = {
  guestMessage: string;
  quickReplies: string[];
  narration: NarrationResult;
  shadowParityScore: number | undefined;
  guestUsesLegacy: boolean;
  narrateMs: number;
  responseData: LegacyChatSuccessData & {
    quickReplies: string[];
    submitOrder: boolean;
    creditsRemaining: number;
  };
  responseMeta: DenisTurnMeta;
};

export type TurnPipelineBase = {
  admin: SupabaseClient;
  channel: "chat" | "voice";
  parsed: DenisChatBody;
  traceId: string;
  turnStarted: number;
  timings: TurnPhaseTimings;
  orgId: string;
  creditBalanceAfter: number;
};

export type { DenisTurnRunInput, DenisChannel };
