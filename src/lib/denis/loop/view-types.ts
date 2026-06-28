import type { SceneLayer, SceneMarkState, SessionPhase } from "@/lib/scene/types";
import type { SceneAccessibility } from "@/lib/denis/cognition/mental-model/accessibility-types";

export type TranscriptEntry = {
  id: string;
  role: "guest" | "denis" | "system";
  text: string;
  at: string;
};

export type OrderSummary = {
  id: string;
  orderNumber: number | null;
  status: string;
  paymentStatus: string;
  estimatedPrepMinutes: number | null;
  items: Array<{ productName: string; quantity: number }>;
};

export type CartView = {
  aiItemCount: number;
  manualItemCount: number;
  visibleItemCount: number;
  hasConflict: boolean;
  conflictPrompt: string | null;
  revision: number;
};

export type AvailableAction = {
  id: string;
  labelKey: string;
  kind: "chip" | "order" | "bill" | "menu";
  orderId?: string;
};

export type DenisDockUrgency = "idle" | "active" | "alert";

export type DenisDockChip = {
  label: string;
  action: string;
  variant: "primary" | "secondary" | "alert";
};

export type DenisReorderOffer = {
  headline: string;
  orderId: string;
  confirmAction: string;
  modifyAction: string;
  confirmLabel: string;
  modifyLabel: string;
};

export type DenisDock = {
  headline: string;
  subline: string | null;
  chips: DenisDockChip[];
  urgency: DenisDockUrgency;
  reorderOffer: DenisReorderOffer | null;
};

export type SmartTipOffer = {
  orderId: string;
  orderTotal: number;
  presets: number[];
  presetAmounts: number[];
  defaultIndex: number;
  defaultPercent: number;
  personalMessage: string;
  denisMessage: string | null;
  sentiment: string;
  showProminent: boolean;
  titleKey: string;
  allowSkip: boolean;
  experienceScore: number | null;
  marketRegion: "de" | "us" | "balkan";
};

export type ReviewFunnelRoute = "google" | "internal";

export type GoogleReviewOffer = {
  orderId: string;
  route: ReviewFunnelRoute;
  googleReviewUrl: string | null;
  message: string;
  delaySeconds: number;
  /** ISO timestamp when guest paid — delay anchor (Q1). */
  paidAnchorAt: string | null;
  feedbackSubmittedAt: string | null;
  confirmLabel: string;
  dismissLabel: string;
  /** Optimal moment that triggered the prompt (L2 orchestration). */
  triggerMoment?: import("@/lib/denis/cognition/proactive/detect-review-moment").ReviewTriggerMoment;
  contentSuggestion?: string | null;
  showInternalForm?: boolean;
  experienceScore?: number;
  recoveryFollowUpMessage?: string | null;
};

/** Optional TELL output — overrides headline when loop just committed narration. */
export type TellResult = {
  headline?: string;
  markState?: SceneMarkState;
} | null;

export type TableSessionView = {
  version: number;
  sessionId: string;
  phase: SessionPhase;
  chrome: {
    tableName: string;
    venueName: string;
    headline: string;
    markState: SceneMarkState;
    denisActive: boolean;
  };
  layers: SceneLayer[];
  transcript: TranscriptEntry[];
  cart: CartView;
  orders: OrderSummary[];
  actions: AvailableAction[];
  dock: DenisDock;
  smartTipOffer: SmartTipOffer | null;
  accessibility: SceneAccessibility | null;
};

export type ProjectViewInput = {
  sessionId: string;
  venueName: string;
  language?: string;
  commercePolicy?: import("@/lib/commerce/policy/commerce-policy.schema").CommercePolicy;
};
