import type { DeclineState } from "@/lib/denis/cognition/mental-model/decline-state";
import type { GuestAccessibilityPrefs } from "@/lib/denis/cognition/mental-model/accessibility-types";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { OrderFact, SessionPhase, TableSessionState } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";
import type { BasketPair } from "@/lib/denis/config/basket-pair-types";
import type { ProductSemanticMeta } from "@/lib/denis/catalog/product-semantics";

export const GUEST_MENTAL_MODEL_VERSION = 1 as const;

export type {
  BeliefDecayCategory,
  BeliefDecayConfig,
} from "@/lib/denis/kernel/beliefs/belief-decay-config";
export { DEFAULT_BELIEF_DECAY_CONFIG } from "@/lib/denis/kernel/beliefs/belief-decay-config";

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

export type GuestScrollIntent = "fast_search" | "slow_category" | "reached_bottom";

/** Folded scroll posture — drives pace, predicted need, and upsell gating. */
export type GuestScrollPosture = {
  latestIntent: GuestScrollIntent | null;
  focusedCategory: string | null;
  searching: boolean;
  /** Guest is lingering on a category — defer generic upsell. */
  deferUpsell: boolean;
  /** Guest reached menu bottom — chef recommendation moment. */
  readyForRecommendation: boolean;
};

export type GuestPredictedNeed =
  | "ready_to_order"
  | "needs_help_choosing"
  | "wants_drink"
  | "wants_dessert"
  | "wants_bill"
  | "needs_attention"
  | "none";

export type GuestReadinessBand = "low" | "medium" | "high";

/** Composite readiness 0–1 from fused signals (Prompt 92). */
export type GuestReadiness = {
  score: number;
  band: GuestReadinessBand;
  /** High readiness — Denis may offer cart submit / confirm. */
  offerSubmit: boolean;
};

export type GuestFusionStyle =
  | "short_direct"
  | "detailed_storytelling"
  | "helpful_discovery"
  | "wait"
  | "reorder_during_meal"
  | "default";

export type GuestFusionGuidance = {
  style: GuestFusionStyle;
  nextLogicalStep: GuestIntent | null;
  abnormalTransition: GuestIntentTransition | null;
  hint: string | null;
};

export type GuestAnomalyKind =
  | "menu_silence"
  | "browse_no_cart"
  | "cart_churn_indecisive"
  | "scroll_fast_search";

export type GuestAnomalySuggestedAction =
  | "gentle_nudge"
  | "offer_help"
  | "offer_comparison";

export type GuestAnomaly = {
  kind: GuestAnomalyKind;
  severity: "low" | "medium";
  suggestedAction: GuestAnomalySuggestedAction;
  detail: string;
};

export type GuestMentalModelFusion = {
  readiness: GuestReadiness;
  guidance: GuestFusionGuidance;
  anomalies: GuestAnomaly[];
};

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

/** L2 — invisible guest predictions (Denis internal only). */
export type GuestNextActionKind =
  | "order_bundle"
  | "needs_help"
  | "add_to_cart"
  | "order_drink"
  | "checkout"
  | "none";

export type GuestNextActionPrediction = {
  action: GuestNextActionKind;
  probability: number;
  label: string;
  preloadProducts: Array<{ productId: string; productName: string }>;
  triggerProactiveHelp: boolean;
};

export type GuestTrajectoryStep =
  | "greet"
  | "drinks"
  | "mains"
  | "dessert"
  | "bill";

export type GuestTrajectoryPrediction = {
  partySize: number;
  predictedMains: number;
  predictedDrinks: number;
  predictedDessert: boolean;
  plannedSteps: GuestTrajectoryStep[];
  currentStep: GuestTrajectoryStep;
  confidence: number;
};

export type GuestSpendTier = "low" | "mid" | "high";

export type GuestUpsellTier = "value" | "standard" | "premium";

export type GuestSpendPrediction = {
  tier: GuestSpendTier;
  predictedTotalCents: number;
  perGuestCents: number;
  confidence: number;
  upsellTier: GuestUpsellTier;
};

export type GuestSessionDurationMode = "efficient" | "normal" | "relaxed";

export type GuestSessionDurationPrediction = {
  predictedMinutes: number;
  mode: GuestSessionDurationMode;
  confidence: number;
  priorSource: "table_history" | "heuristic";
};

export type GuestPredictiveModel = {
  nextAction: GuestNextActionPrediction;
  trajectory: GuestTrajectoryPrediction;
  spend: GuestSpendPrediction;
  duration: GuestSessionDurationPrediction;
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
  /** Max recommendable unit price (EUR) from browse signals; null = no ceiling. */
  priceCeilingEur: number | null;
  scrollPosture: GuestScrollPosture;
  predictedNeed: GuestPredictedNeed;
  affect: GuestAffect;
  groupDynamics: GuestGroupDynamics;
  fusion: GuestMentalModelFusion;
  /** L2 predictive modeling — never shown to guest UI. */
  predictions: GuestPredictiveModel;
  accessibility?: GuestAccessibilityPrefs | null;
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
  /** When provided, skips internal foldGuestSignals (ADR-040 PDS-4). */
  spine?: GuestSignalSpine;
  /** Optional table EWMA prior for session duration (L2). */
  tableTurnoverPriorMinutes?: number | null;
  /** Override clock context for deterministic tests. */
  localHour?: number;
  dayOfWeek?: number;
  /** Catalog semantic tags for L2 predictions (menuSection, foodTags, drinkFamily). */
  productCatalog?: Record<string, ProductSemanticMeta>;
  /** Learned basket pairs for bundle prediction. */
  basketPairs?: BasketPair[];
};
