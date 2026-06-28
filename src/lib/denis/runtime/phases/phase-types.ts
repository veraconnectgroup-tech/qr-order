import type { ApiSuccessBody } from "@/lib/api-response";
import type { AiStructuredResponse } from "@/lib/ai/types";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import type { RecoveryAction } from "@/lib/denis/cognition/recovery";
import type { TurnPlan } from "@/lib/denis/cognition/tde";
import type { PendingSlotActResult } from "@/lib/denis/runtime/act/resolve-pending-slot-act";
import type { ActHandoffOutcome } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import type { ActOrderChangeOutcome } from "@/lib/denis/runtime/act/resolve-act-order-change-outcome";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type {
  DenisChatBody,
  DenisTurnContext,
  DenisTurnMeta,
  DenisTurnRunInput,
} from "@/lib/denis/runtime/turn-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

export type PerceiveChatPayload = ApiSuccessBody<AiStructuredResponse> & {
  error?: unknown;
};

export type TdePerceiveResult = {
  response: Response;
  turnPlan: TurnPlan;
  llmUsed: boolean;
  planKind: string;
  tier: string;
  modelTier?: string;
  model?: string | null;
  complexityScore?: number;
  evidencePointers: string[];
  pendingSlotActResolved?: boolean;
  cartDraftFromAct?: DenisCartDraft;
  frustrationRecovery?: RecoveryAction[];
};

export type PreparedTurnContext = {
  ctx: DenisTurnContext;
  chatAiSessionId: string | null;
  timelineAiSessionIdForHealth?: string;
  healthEvaluation: { status: string; [key: string]: unknown };
  healthMetrics?: unknown;
  healthStateTransition?: unknown;
  degradationTransition?: unknown;
  contextMs?: number;
  ctxMs?: number;
};

export type PerceiveTurnResult = {
  ctx: DenisTurnContext;
  perceiveResult: TdePerceiveResult;
  perceivePayload: PerceiveChatPayload;
  perceiveData: AiStructuredResponse;
  beliefGraph: BeliefGraph | null;
  reflexTurn: ReflexTurnResult;
  slotExtract: { items: unknown[]; tier?: string } | null;
  timelineEnabled: boolean;
  rolloutMode: ConciergeRolloutMode;
  pendingSlot: PendingSlotKind | string | null;
  aiSessionId: string | null;
  timelineAiSessionId: string | null;
  perceiveBody: DenisChatBody;
  profileTier: string;
  frustrationRecovery: RecoveryAction[];
  legacyMs: number;
};

export type ActOnTurnResult = {
  ctx: DenisTurnContext;
  perceiveData: AiStructuredResponse;
  cartDraftForAct: DenisCartDraft;
  actPhase: ActPhaseResult;
  actSubmitLive: boolean;
  actSubmitOutcome: ReturnType<typeof import("@/lib/denis/runtime/act").resolveActSubmitOutcome>;
  turnSubmitOutcome: ReturnType<typeof import("@/lib/denis/runtime/act").resolveActSubmitOutcome>;
  actHandoffOutcome: ActHandoffOutcome;
  actOrderChangeOutcome: ActOrderChangeOutcome;
  allergyCtx: unknown;
  waiterObligation: WaiterObligation;
  pendingSlotActApplied: boolean;
  actMs: number;
};

export type NarrateTurnResult = {
  guestMessage: string;
  quickReplies: string[];
  narration: {
    message: string;
    tier: string;
    lintPassed: boolean;
    usedFallback: boolean;
  };
  shadowParityScore?: number;
  guestUsesLegacy: boolean;
  narrateMs: number;
  responseData: AiStructuredResponse & Record<string, unknown>;
  responseMeta: DenisTurnMeta;
};

export type ResolvedPendingSlotAct = Extract<
  PendingSlotActResult,
  { resolved: true }
>;

export type { DenisTurnRunInput };

export type ParsedTurnInput =
  | { ok: true; channel: "chat" | "voice"; data: DenisChatBody }
  | { ok: false; response: Response };
