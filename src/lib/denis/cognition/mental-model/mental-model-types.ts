import type { DeclineState } from "@/lib/denis/cognition/mental-model/decline-state";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { OrderFact, SessionPhase, TableSessionState } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";

export const GUEST_MENTAL_MODEL_VERSION = 1 as const;

export type GuestIntent =
  | "arrived"
  | "exploring"
  | "comparing"
  | "decided"
  | "ordering"
  | "waiting_food"
  | "eating"
  | "finishing"
  | "paying";

export type GuestPace = "rushed" | "normal" | "relaxed" | "indecisive";

export type GuestReceptiveness =
  | "enthusiastic"
  | "open"
  | "neutral"
  | "polite_decline"
  | "closed";

export type GuestEngagement = {
  guestTurns: number;
  avgMsgLen: number;
  guestInitiated: boolean;
  nudgeResponseRate: number;
};

export type GuestNudgeBudget = {
  remaining: number;
  max: number;
  cooldownUntil: number | null;
};

export type GuestMealStage =
  | "pre_order"
  | "aperitif"
  | "main"
  | "between_courses"
  | "dessert_window"
  | "post_meal"
  | "paying";

export type GuestPriceAffinity = "budget" | "mid" | "premium" | "unknown";

export type GuestPredictedNeed =
  | "ready_to_order"
  | "needs_help_choosing"
  | "wants_drink"
  | "wants_dessert"
  | "wants_bill"
  | "needs_attention"
  | "none";

export type GuestFrustrationLevel = "none" | "mild" | "high";

export type GuestFrustration = {
  level: GuestFrustrationLevel;
  signals: string[];
};

export type GuestMicroSentiment = {
  score: number;
  lastSignals: string[];
};

/** Merged frustration + micro-sentiment (ADR-038 Val C). */
export type GuestAffect = {
  frustration: GuestFrustration;
  sentiment: GuestMicroSentiment;
};

export type GuestGroupMode = "solo" | "party";

export type GuestGroupDynamics = {
  mode: GuestGroupMode;
  leaderDevice: string | null;
  followerDevices: string[];
  /** True when proactive should address this device (leader in party). */
  addressLeader: boolean;
};

export type GuestIntentTransition = {
  from: GuestIntent;
  to: GuestIntent;
  at: number;
  durationMs: number;
};

/** Prior fold context restored from timeline for transition derivation (ADR-038 Val D). */
export type PreviousMentalFoldContext = {
  intent: GuestIntent;
  computedAt: number;
  intentTransitions: GuestIntentTransition[];
};

/** ADR-038 — folded guest posture (rebuilt every FOLD). Alias: GuestPosture. */
export type GuestMentalModel = {
  version: typeof GUEST_MENTAL_MODEL_VERSION;
  computedAt: number;
  confidence: number;
  hash: string;
  decline: DeclineState;
  intent: GuestIntent;
  intentTransitions: GuestIntentTransition[];
  pace: GuestPace;
  receptiveness: GuestReceptiveness;
  engagement: GuestEngagement;
  nudgeBudget: GuestNudgeBudget;
  mealStage: GuestMealStage;
  priceAffinity: GuestPriceAffinity;
  predictedNeed: GuestPredictedNeed;
  affect: GuestAffect;
  groupDynamics: GuestGroupDynamics;
};

/** Operational guest posture — same snapshot as GuestMentalModel (Val A). */
export type GuestPosture = GuestMentalModel;

export type FoldGuestMentalModelInput = {
  timeline: DenisTimelineRow[];
  browse: GuestBrowseProfile;
  conversation: ConversationModel;
  commerce: Pick<TableSessionState["commerce"], "orders" | "cart">;
  party?: TablePartyModel | null;
  session: Pick<TableSessionState["session"], "billSettled">;
  conversationMeta: Pick<
    TableSessionState["conversation"],
    "flowNodeId" | "dismissedNudges"
  >;
  phase: SessionPhase;
  config: ConciergeConfig;
  previousFold?: PreviousMentalFoldContext | null;
  now?: number;
};
