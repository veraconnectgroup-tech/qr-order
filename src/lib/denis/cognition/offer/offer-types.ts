import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type {
  GuestIntent,
  GuestMentalModel,
  GuestPace,
  GuestPredictedNeed,
  GuestPriceAffinity,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { SessionPhase } from "@/lib/scene/types";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";
import type {
  OfferConversionRecord,
  ProductNudgeStats,
} from "@/lib/denis/cognition/offer/offer-conversion-types";
import type {
  NudgeOutcomeRecord,
  PendingNudge,
} from "@/lib/denis/cognition/offer/nudge-outcome-types";
import type { AttributedNudgeRevenue } from "@/lib/denis/cognition/offer/fold-nudge-revenue";
import type { OrderFact } from "@/lib/denis/loop/types";

export const GUEST_OFFER_CONTEXT_VERSION = 1 as const;

export type BrowseSequenceEntry = {
  at: string;
  action: "view_category" | "view_product" | "add_to_cart" | "remove_from_cart" | "scroll_menu";
  productId?: string;
  categoryId?: string;
  menuSection?: "food" | "drinks" | "desserts" | null;
  dwellMs?: number;
};

export type BrowseSequencePattern =
  | "normal_flow"
  | "price_sensitive"
  | "decisive"
  | "explorer"
  | "return_view"
  | "unknown";

export type OfferReadinessReason =
  | "browse_pause"
  | "return_view"
  | "cart_hesitation"
  | "posture_ready"
  | "not_ready_idle"
  | "not_ready_posture"
  | "not_ready_venue"
  | "not_ready_commerce";

export type OfferReadiness = {
  ready: boolean;
  reason: OfferReadinessReason;
  secondsSinceLastBrowseAction: number;
};

export type OfferResolutionKind =
  | "top_dwell"
  | "return_view"
  | "cart_recovery"
  | "kitchen_alternative"
  | "category_affinity";

export type ResolvedOffer = {
  productId: string;
  productName: string;
  categoryId: string | null;
  resolution: OfferResolutionKind;
  score: number;
  dedupeKey: string;
  isKitchenBlocked: boolean;
};

export type OfferResolutionTrace = {
  strategy: string;
  posture: {
    predictedNeed: GuestPredictedNeed;
    intent: GuestIntent;
    pace: GuestPace;
    priceAffinity: GuestPriceAffinity;
  };
  browse: {
    topProductId: string | null;
    topDwellMs: number;
    sequencePattern: BrowseSequencePattern;
    cartAbandonedCount: number;
  };
  venue: {
    kdsStress: VenueOpsBeliefs["kdsStress"];
    operatingMode: VenueOpsBeliefs["operatingMode"];
  };
  readiness: OfferReadiness;
  conversions: OfferConversionRecord[];
  nudgeStats: Record<string, ProductNudgeStats>;
  outcomes: NudgeOutcomeRecord[];
  pendingNudges: PendingNudge[];
  sessionAttachRate: number;
  attributedRevenue: AttributedNudgeRevenue[];
  attributedRevenueCents: number;
};

export type ScoredBrowseProduct = GuestBrowseProfile["viewedProducts"][0] & {
  score: number;
  lastViewedAt: string;
};

/** ADR-038 GMM-9 — resolved offer snapshot (pure fold). */
export type GuestOfferContext = {
  version: typeof GUEST_OFFER_CONTEXT_VERSION;
  computedAt: number;
  hash: string;
  readiness: OfferReadiness;
  primary: ResolvedOffer | null;
  alternative: ResolvedOffer | null;
  cartRecovery: ResolvedOffer | null;
  sequencePattern: BrowseSequencePattern;
  scoredProducts: ScoredBrowseProduct[];
  trace: OfferResolutionTrace;
};

export type FoldGuestOfferContextInput = {
  timeline: import("@/lib/denis/platform/timeline-types").DenisTimelineRow[];
  browse: GuestBrowseProfile;
  mental: GuestMentalModel;
  spine: GuestSignalSpine;
  venueOps: VenueOpsBeliefs;
  phase: SessionPhase;
  cartLineCount: number;
  config: ConciergeConfig;
  now?: number;
  orders?: OrderFact[];
};
