import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import {
  detectDessertTrigger,
  detectKitchenBusyPreorderTrigger,
  detectKitchenBusyTrigger,
  detectOrderPreparingNotifyTrigger,
  detectOrderEtaUpdateTrigger,
  detectDrinkRefillTrigger,
  detectDrinkWithFoodTrigger,
  detectHappyHourUpsellTrigger,
  detectOrderReadyNotifyTrigger,
  detectPairingTrigger,
  detectReviewTrigger,
  detectRoundTwoTrigger,
  detectSlowKitchenTrigger,
  hasActiveDrinkOrder,
  resolveEnforceDessertPosture,
} from "@/lib/denis/cognition/proactive/triggers";
import { detectScrollInterestTrigger } from "@/lib/denis/cognition/proactive/detect-scroll-interest-trigger";
import {
  detectBrowseProductFollowUp,
  detectCategoryBrowseNudge,
  detectDessertCategoryInterest,
} from "@/lib/denis/cognition/browse/detect-browse-triggers";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { filterProactiveCandidatesByMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-intelligence";
import { isCartRecoveryCandidateReady } from "@/lib/denis/cognition/offer/smart-cart-recovery";
import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import { resolveFollowUpDueAt } from "@/lib/denis/cognition/conversation/guest-continuity";
import { buildAttentionHandoffMessage } from "@/lib/denis/cognition/proactive/build-attention-handoff-message";
import {
  buildDessertMessage,
  buildDrinkRefillMessage,
  buildDrinkWithFoodMessage,
  buildHappyHourUpsellMessage,
  buildKitchenBusyMessage,
  buildKitchenBusyPreorderMessage,
  buildCookingGrillStartedMessage,
  buildCookingPlatingMessage,
  buildOrderDelayMessage,
  buildOrderEtaUpdateMessage,
  buildOrderPreparingNotifyMessage,
  buildOrderReadyMessage,
  buildPopularityMessage,
  buildRoundTwoMessage,
  buildSlowKitchenMessage,
  buildStationBottleneckMessage,
  buildWelcomeMessage,
} from "@/lib/denis/cognition/proactive/proactive-message-builders";
import {
  detectCookingGrillStartedTrigger,
  detectCookingPlatingTrigger,
  detectStationBottleneckAvoidanceTrigger,
} from "@/lib/denis/cognition/proactive/kitchen-mind-triggers";
import {
  detectPartyDrinkGapTrigger,
  detectSommelierFoodPairingTrigger,
  detectSommelierRefillTrigger,
} from "@/lib/denis/cognition/proactive/drink-sommelier-triggers";
import { formatPartyDrinkGapMessage } from "@/lib/denis/intelligence/drink-sommelier";
import type {
  GuestProactiveNudge,
  GuestProactiveNudgeKind,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import {
  deriveCheckTier,
  revenueCheckTierPriorityBoost,
  revenueStrategyPriorityBoost,
  shouldSkipDessertForRevenueStrategy,
  type RevenueStrategy,
} from "@/lib/denis/config/revenue-intelligence";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import { shouldAllowEventProactiveNudge } from "@/lib/denis/venue/ops/event-mode";
import type { SessionPhase } from "@/lib/scene/types";
import { buildPartyIncompleteMessage } from "@/lib/denis/venue/party/derive-party-intelligence";
import type { PartyIntelligenceFacts } from "@/lib/denis/venue/party/derive-party-intelligence";
import {
  shouldSuggestBillForTurnover,
  type TableTurnoverPrediction,
} from "@/lib/denis/intelligence/table-turnover";
import { shouldSkipProactiveForUnavailableProduct } from "@/lib/denis/intelligence/inventory-awareness";
import {
  buildPuzzleNudgeMessage,
  isMenuEngineeringBlocked,
  menuEngineeringScoreMultiplier,
  type MenuEngineeringCategory,
} from "@/lib/denis/platform/menu-engineering";

export type RankedProactiveCandidate = {
  nudge: GuestProactiveNudge;
  priority: number;
  source: string;
};

export type RankProactiveCandidatesInput = {
  config: Pick<ConciergeConfig, "proactive" | "upsell" | "mentalModel" | "handoff">;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
  browse?: GuestBrowseProfile | null;
  mental?: GuestMentalModel | null;
  partyFacts?: PartyIntelligenceFacts | null;
  venueOps?: VenueOpsBeliefs | null;
  opsEffects?: OpsPlannerEffects | null;
  offer?: GuestOfferContext | null;
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
    guestWelcome: string;
    browseFollowUp: string;
    billPrompt: string;
    orderDelay: string;
    popularityPair: string;
  };
  now?: number;
  /** H2 — venue-wide revenue strategy from rhythm priors. */
  revenueStrategy?: RevenueStrategy | null;
  /** H2 — session check total in EUR for per-table posture. */
  sessionCheckEuros?: number;
  /** K2 — BCG category map for proactive priority / dog filter. */
  menuEngineeringCategories?: Record<
    string,
    import("@/lib/denis/platform/menu-engineering").MenuEngineeringCategory
  >;
  /** Venue-wide kitchen orders for Kitchen Mind Link (bottleneck + pulse). */
  venueKitchenOrders?: AiGuestOrder[];
  /** Cart lines for bottleneck avoidance during ordering. */
  cartItems?: Array<{
    productId: string;
    productName: string;
    menuSection?: string | null;
    foodTags?: string[];
    prepStation?: string | null;
  }>;
};

function isDismissed(keys: string[], key: string): boolean {
  return keys.includes(key);
}

function isDrinkPairingDismissedForOrder(
  dismissed: string[],
  orderId: string
): boolean {
  return (
    isDismissed(dismissed, `sommelier_pairing:${orderId}`) ||
    isDismissed(dismissed, "sommelier_pairing") ||
    isDismissed(dismissed, `drink_pairing:${orderId}`) ||
    isDismissed(dismissed, "drink_pairing") ||
    isDismissed(dismissed, `drink_with_food:${orderId}`) ||
    isDismissed(dismissed, "drink_with_food")
  );
}

function isMentalFirst(config: RankProactiveCandidatesInput["config"]): boolean {
  return resolveMentalModelMode(config as ConciergeConfig) !== "off";
}

function venueSuppressesBrowse(input: RankProactiveCandidatesInput): boolean {
  return (
    input.venueOps?.operatingMode === "rush" ||
    input.opsEffects?.skipUpsell === true
  );
}

function isEnforceMode(config: RankProactiveCandidatesInput["config"]): boolean {
  return resolveMentalModelMode(config as ConciergeConfig) === "enforce";
}

const LEGACY_KIND_PRIORITY: Record<GuestProactiveNudgeKind, number> = {
  attention_handoff: 1050,
  order_ready_notify: 1100,
  cooking_plating: 1088,
  cooking_grill_started: 1085,
  order_ready: 1080,
  guest_welcome: 1000,
  browse_follow_up: 900,
  kitchen_busy_preorder: 940,
  kitchen_busy: 920,
  station_bottleneck_avoid: 830,
  order_eta_update: 860,
  slow_kitchen: 900,
  order_delay: 840,
  dessert_nudge: 700,
  bill_prompt: 680,
  google_review: 675,
  internal_feedback: 665,
  popularity_pair: 600,
  browse_nudge: 500,
  cart_recovery: 960,
  drink_refill: 820,
  sommelier_refill: 825,
  sommelier_pairing: 815,
  party_drink_gap: 805,
  round_two: 810,
  drink_with_food: 800,
  drink_pairing: 400,
  happy_hour_upsell: 620,
  waiter_gap: 950,
  party_incomplete: 875,
  scroll_search: 780,
  scroll_category: 770,
  scroll_bottom: 760,
  cart_abandonment_prevention: 955,
};

function posturePriority(
  kind: GuestProactiveNudgeKind,
  mental: GuestMentalModel
): number {
  const need = mental.predictedNeed;
  const table: Partial<Record<GuestProactiveNudgeKind, number>> = {
    attention_handoff: 1100,
    order_ready_notify: 1095,
    order_ready: 1090,
    order_eta_update: need === "needs_attention" ? 1005 : 855,
    order_delay: need === "needs_attention" ? 1000 : 820,
    slow_kitchen: need === "needs_attention" ? 1010 : 895,
    kitchen_busy_preorder: 945,
    kitchen_busy: need === "needs_help_choosing" ? 935 : 915,
    bill_prompt: need === "wants_bill" ? 980 : 670,
    dessert_nudge: need === "wants_dessert" ? 970 : 690,
    browse_follow_up: need === "needs_help_choosing" ? 960 : 880,
    browse_nudge: need === "needs_help_choosing" ? 950 : 490,
    cart_recovery: need === "needs_help_choosing" ? 965 : 955,
    popularity_pair: need === "needs_help_choosing" ? 940 : 590,
    guest_welcome: mental.intent === "arrived" ? 930 : 990,
    drink_refill: 825,
    round_two: 815,
    drink_with_food: 805,
    drink_pairing: 750,
    happy_hour_upsell: 625,
    google_review: 672,
    internal_feedback: 662,
    scroll_search: need === "needs_help_choosing" ? 780 : 520,
    scroll_category: need === "needs_help_choosing" ? 775 : 515,
    scroll_bottom: need === "needs_help_choosing" ? 770 : 510,
  };

  return table[kind] ?? LEGACY_KIND_PRIORITY[kind] ?? 0;
}

function priorityForKind(
  kind: GuestProactiveNudgeKind,
  mentalFirst: boolean,
  mental: GuestMentalModel | null | undefined
): number {
  if (mentalFirst && mental) {
    return posturePriority(kind, mental);
  }
  return LEGACY_KIND_PRIORITY[kind] ?? 0;
}

function applyRevenuePriorityBoost(
  kind: GuestProactiveNudgeKind,
  basePriority: number,
  input: Pick<
    RankProactiveCandidatesInput,
    "revenueStrategy" | "sessionCheckEuros"
  >
): number {
  const strategy = input.revenueStrategy;
  const checkTier = deriveCheckTier(input.sessionCheckEuros ?? 0);
  let priority = basePriority;

  if (
    kind === "dessert_nudge" ||
    kind === "bill_prompt" ||
    kind === "popularity_pair" ||
    kind === "drink_pairing" ||
    kind === "drink_with_food" ||
    kind === "browse_nudge"
  ) {
    priority += revenueStrategyPriorityBoost(
      kind === "browse_nudge"
        ? "popularity_pair"
        : kind === "drink_with_food"
          ? "drink_pairing"
          : kind,
      strategy
    );
    priority += revenueCheckTierPriorityBoost(
      kind === "browse_nudge"
        ? "browse_nudge"
        : kind === "drink_with_food"
          ? "drink_with_food"
          : kind === "bill_prompt"
            ? "bill_prompt"
            : kind === "dessert_nudge"
              ? "dessert_nudge"
              : kind === "popularity_pair"
                ? "popularity_pair"
                : "drink_pairing",
      strategy,
      checkTier
    );
  }

  return priority;
}

function isPartyIncompleteFacts(value: unknown): value is {
  isPartyIncomplete: boolean;
  isPartyIncompleteForCurrentDevice?: boolean;
  devicesWithOrder: number;
  partySize: number;
  partyMode: "shared_cart" | "per_device";
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.isPartyIncomplete === true &&
    typeof record.devicesWithOrder === "number" &&
    typeof record.partySize === "number"
  );
}

function shouldOfferPartyIncompleteNudge(value: unknown): value is {
  isPartyIncomplete: boolean;
  isPartyIncompleteForCurrentDevice?: boolean;
  devicesWithOrder: number;
  partySize: number;
  partyMode: "shared_cart" | "per_device";
} {
  if (!isPartyIncompleteFacts(value)) return false;
  return value.isPartyIncompleteForCurrentDevice !== false;
}

function resolvePartySize(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const partySize = (value as Record<string, unknown>).partySize;
  return typeof partySize === "number" && partySize >= 2 ? partySize : null;
}

function shouldOfferGuestWelcome(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  guestMessageCount: number;
  hasBrowseTelemetry?: boolean;
}): boolean {
  if (input.enforceMode) {
    return input.guestMessageCount === 0 && !input.hasBrowseTelemetry;
  }
  if (input.mentalFirst && input.mental) {
    return (
      input.mental.intent === "arrived" && !input.mental.engagement.guestInitiated
    );
  }
  return input.guestMessageCount === 0;
}

function shouldOfferBrowseNudge(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  browseMinutes: number;
  thresholdMinutes: number;
}): boolean {
  if (input.enforceMode) {
    if (!input.mental) return false;
    return (
      (input.mental.intent === "exploring" ||
        input.mental.intent === "comparing") &&
      input.mental.predictedNeed === "needs_help_choosing"
    );
  }
  if (input.mentalFirst && input.mental) {
    return (
      (input.mental.intent === "exploring" ||
        input.mental.intent === "comparing") &&
      input.mental.predictedNeed === "needs_help_choosing"
    );
  }
  return input.browseMinutes >= input.thresholdMinutes;
}

function shouldOfferPopularityPair(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  guestAskedRecommendation: boolean;
  browseMinutes: number;
  thresholdMinutes: number;
  explicitPair?: boolean;
}): boolean {
  if (input.enforceMode) return true;
  if (input.explicitPair) return true;
  if (input.mentalFirst && input.mental) {
    return (
      input.guestAskedRecommendation ||
      input.mental.intent === "comparing" ||
      (input.mental.intent === "exploring" &&
        input.mental.predictedNeed === "needs_help_choosing")
    );
  }
  return (
    input.guestAskedRecommendation || input.browseMinutes >= input.thresholdMinutes
  );
}

function shouldOfferBillPrompt(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  idleMinutes: number;
  thresholdMinutes: number;
  orders: AiGuestOrder[];
  now: number;
  sessionPhase?: SessionPhase | null;
}): boolean {
  if (input.enforceMode) {
    if (
      input.sessionPhase === "browsing" ||
      input.sessionPhase === "ordering" ||
      input.sessionPhase === "latent"
    ) {
      if (input.sessionPhase === "latent" && !input.mental) {
        return true;
      }
      return (
        (input.mental?.mealStage === "post_meal" ||
          input.mental?.mealStage === "paying") &&
        input.mental?.predictedNeed === "wants_bill"
      );
    }
    return true;
  }
  if (input.mentalFirst && input.mental) {
    return (
      (input.mental.mealStage === "post_meal" ||
        input.mental.mealStage === "paying") &&
      input.mental.predictedNeed === "wants_bill"
    );
  }

  if (input.idleMinutes < input.thresholdMinutes) return false;

  const delivered = input.orders
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    );
  const latest = delivered[0];
  if (!latest) return false;

  const reference = latest.delivered_at ?? latest.created_at;
  const mins = (input.now - new Date(reference).getTime()) / 60_000;
  return mins >= input.thresholdMinutes;
}

function shouldOfferDessert(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
}): boolean {
  if (input.enforceMode) return true;
  if (!input.mentalFirst || !input.mental) return true;
  return (
    input.mental.mealStage === "dessert_window" &&
    input.mental.predictedNeed === "wants_dessert"
  );
}

/** Collect all eligible proactive candidates, scored by posture (ADR-038 GMM-6). */
export function rankProactiveCandidates(
  input: RankProactiveCandidatesInput
): RankedProactiveCandidate[] {
  const { config, orders, payload, messages, mental } = input;
  const now = input.now ?? Date.now();
  const dismissed = payload.dismissedNudgeKeys ?? [];
  const hasOrdered = Boolean(payload.hasSessionOrders);
  const guestRequestedFollowUp = Boolean(payload.followUpRequestedAt);
  const mentalFirst = isMentalFirst(config);
  const enforceMode = isEnforceMode(config);
  const browseMinutes = payload.browseMinutes ?? 0;
  const idleMinutes = payload.idleMinutes ?? 0;
  const guestMessageCount = payload.guestMessageCount ?? 0;
  const candidates: RankedProactiveCandidate[] = [];
  const revenueContext = {
    revenueStrategy: input.revenueStrategy,
    sessionCheckEuros: input.sessionCheckEuros,
  };

  function pushCandidate(
    bucket: RankedProactiveCandidate[],
    nudge: GuestProactiveNudge,
    source: string,
    mentalFirstLocal: boolean,
    mentalLocal: GuestMentalModel | null | undefined,
    menuCategory?: MenuEngineeringCategory
  ): void {
    if (isMenuEngineeringBlocked(menuCategory)) return;

    const base = priorityForKind(nudge.kind, mentalFirstLocal, mentalLocal);
    let priority = applyRevenuePriorityBoost(nudge.kind, base, revenueContext);
    priority = Math.round(priority * menuEngineeringScoreMultiplier(menuCategory));
    if (source === "browse_dessert_interest") {
      priority = Math.max(priority, 1120);
    }
    if (source === "popularity" && payload.popularityPair) {
      priority = Math.max(priority, 960);
    }

    bucket.push({
      nudge,
      priority,
      source,
    });
  }

  function pushBrowseCandidate(
    nudge: GuestProactiveNudge,
    source: string
  ): void {
    pushCandidate(candidates, nudge, source, mentalFirst, mental);
  }

  const cartAbandonedRemovedAt = payload.cartAbandonedRemovedAt?.trim() ?? null;
  const cartRecoverySecondsSinceRemove =
    cartAbandonedRemovedAt && Number.isFinite(Date.parse(cartAbandonedRemovedAt))
      ? Math.max(0, (now - Date.parse(cartAbandonedRemovedAt)) / 1000)
      : 0;
  const cartRecoveryReady = isCartRecoveryCandidateReady(
    input.offer,
    cartRecoverySecondsSinceRemove
  );

  if (
    cartRecoveryReady &&
    input.offer?.smartRecovery?.message &&
    !isDismissed(dismissed, "cart_recovery")
  ) {
    pushCandidate(
      candidates,
      {
        kind: "cart_recovery",
        message: input.offer.smartRecovery.message,
      },
      "cart_recovery",
      mentalFirst,
      mental
    );
  }

  if (
    mentalFirst &&
    mental?.predictedNeed === "needs_attention" &&
    (mental.affect.frustration.level === "high" ||
      mental.affect.frustration.level === "mild") &&
    !isDismissed(dismissed, "attention_handoff") &&
    config.handoff.waiterCall &&
    !(
      !hasOrdered &&
      input.browse &&
      detectDessertCategoryInterest({
        browse: input.browse,
        hasOrdered,
        language: payload.language,
      })
    )
  ) {
    pushCandidate(
      candidates,
      {
        kind: "attention_handoff",
        message: buildAttentionHandoffMessage(payload.language),
      },
      "attention_handoff",
      mentalFirst,
      mental
    );
  }

  if (
    config.proactive.guestWelcome &&
    !isDismissed(dismissed, "guest_welcome") &&
    shouldOfferGuestWelcome({
      enforceMode,
      mentalFirst,
      mental,
      guestMessageCount,
      hasBrowseTelemetry: Boolean(input.browse?.viewedProducts.length),
    }) &&
    (payload.sessionAgeSeconds ?? 0) >= config.proactive.guestWelcomeSeconds
  ) {
    pushCandidate(
      candidates,
      {
        kind: "guest_welcome",
        message: buildWelcomeMessage(
          payload.venueName,
          payload.language,
          payload.todaySpecial,
          messages.guestWelcome,
          payload.rhythmTopProductName,
          payload.servicePeriod
        ),
      },
      "welcome",
      mentalFirst,
      mental
    );
  }

  if (
    config.proactive.browseFollowUp &&
    input.browse &&
    !payload.browseFollowUpEmitted &&
    !isDismissed(dismissed, "browse_follow_up") &&
    !hasOrdered
  ) {
    const productFollowUp = detectBrowseProductFollowUp({
      browse: input.browse,
      hasOrdered,
      language: payload.language,
      nowMs: now,
    });
    if (productFollowUp) {
      pushCandidate(
        candidates,
        {
          kind: "browse_follow_up",
          message: productFollowUp.message,
          prompt: `Follow up on ${productFollowUp.productName} browse interest.`,
        },
        "browse_product_follow_up",
        mentalFirst,
        mental
      );
    }
  }

  if (
    config.proactive.browseFollowUp &&
    payload.browsingDeferredAt &&
    !payload.browseFollowUpEmitted &&
    !isDismissed(dismissed, "browse_follow_up") &&
    (guestRequestedFollowUp || !hasOrdered) &&
    guestMessageCount > 0
  ) {
    const dueAt = resolveFollowUpDueAt(
      {
        lastDeferredAt: payload.browsingDeferredAt,
        deferCount: payload.browsingDeferCount ?? 1,
        followUpEmitted: payload.browseFollowUpEmitted ?? false,
        followUpRequestedAt: payload.followUpRequestedAt ?? null,
        followUpDelaySeconds: payload.followUpDelaySeconds ?? null,
      },
      config.proactive.browseFollowUpSeconds
    );
    if (dueAt != null && now >= dueAt) {
      pushCandidate(
        candidates,
        { kind: "browse_follow_up", message: messages.browseFollowUp },
        "browse_follow_up",
        mentalFirst,
        mental
      );
    }
  }

  if (
    shouldOfferPartyIncompleteNudge(input.partyFacts) &&
    !isDismissed(dismissed, "party_incomplete")
  ) {
    pushCandidate(
      candidates,
      {
        kind: "party_incomplete",
        message: buildPartyIncompleteMessage(
          input.partyFacts,
          input.payload.language
        ),
      },
      "party",
      mentalFirst,
      mental
    );
  }

  if (!isDismissed(dismissed, "order_ready_notify")) {
    const ready = detectOrderReadyNotifyTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `order_ready_notify:${orderId}`) ||
        isDismissed(dismissed, "order_ready_notify") ||
        isDismissed(dismissed, `order_ready:${orderId}`) ||
        isDismissed(dismissed, "order_ready")
    );
    if (ready?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "order_ready_notify",
          message: buildOrderReadyMessage({
            language: payload.language,
            orderItemsLabel: ready.orderItemsLabel,
          }),
          orderId: ready.orderId,
        },
        "order_ready_notify",
        mentalFirst,
        mental
      );
    }
  }

  if (!isDismissed(dismissed, "cooking_grill_started")) {
    const grillStarted = detectCookingGrillStartedTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `cooking_grill_started:${orderId}`) ||
        isDismissed(dismissed, "cooking_grill_started"),
      now
    );
    if (grillStarted?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "cooking_grill_started",
          message: buildCookingGrillStartedMessage({
            language: payload.language,
            orderItemsLabel: grillStarted.orderItemsLabel,
          }),
          orderId: grillStarted.orderId,
        },
        "cooking_grill_started",
        mentalFirst,
        mental
      );
    }
  }

  if (!isDismissed(dismissed, "cooking_plating")) {
    const readyNotify = detectOrderReadyNotifyTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `order_ready_notify:${orderId}`) ||
        isDismissed(dismissed, "order_ready_notify") ||
        isDismissed(dismissed, `order_ready:${orderId}`) ||
        isDismissed(dismissed, "order_ready")
    );
    const plating = detectCookingPlatingTrigger(orders, (orderId) =>
      isDismissed(dismissed, `cooking_plating:${orderId}`) ||
      isDismissed(dismissed, "cooking_plating") ||
      readyNotify?.orderId === orderId
    );
    if (plating?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "cooking_plating",
          message: buildCookingPlatingMessage({
            language: payload.language,
            orderItemsLabel: plating.orderItemsLabel,
          }),
          orderId: plating.orderId,
        },
        "cooking_plating",
        mentalFirst,
        mental
      );
    }
  }

  const venueOrders = input.venueKitchenOrders ?? orders;
  const cartItems = input.cartItems ?? [];
  if (
    cartItems.length > 0 &&
    !isDismissed(dismissed, "station_bottleneck_avoid")
  ) {
    const bottleneck = detectStationBottleneckAvoidanceTrigger({
      cartItems,
      venueOrders,
      sessionPhase: payload.sessionPhase,
      isShown: (key) => isDismissed(dismissed, key),
    });
    if (bottleneck) {
      pushCandidate(
        candidates,
        {
          kind: "station_bottleneck_avoid",
          message: buildStationBottleneckMessage({
            language: payload.language,
            productName: bottleneck.productName,
            alternativeName: bottleneck.alternativeName,
            prepMinutes: bottleneck.prepMinutes,
          }),
        },
        "station_bottleneck_avoid",
        mentalFirst,
        mental
      );
    }
  }

  if (
    payload.sessionPhase === "ordering" &&
    !isDismissed(dismissed, "kitchen_busy_preorder")
  ) {
    const kitchenStation = input.venueOps?.stationStress?.find(
      (station) => station.station === "kitchen"
    );
    const kitchenPending =
      payload.kitchenPendingCount ?? kitchenStation?.activeCount ?? 0;
    const preorderBusy = detectKitchenBusyPreorderTrigger({
      sessionPhase: payload.sessionPhase,
      kitchenPendingCount: kitchenPending,
      estimatedWaitMinutes:
        payload.kitchenEstimatedWaitMinutes ??
        input.opsEffects?.capacityBanner?.estimatedWaitMinutes ??
        kitchenStation?.avgWaitMinutes ??
        null,
      hasFoodInCart: Boolean(payload.hasFoodInCart ?? (payload.cartItemCount ?? 0) > 0),
      isShown: () => isDismissed(dismissed, "kitchen_busy_preorder"),
    });
    if (preorderBusy) {
      pushCandidate(
        candidates,
        {
          kind: "kitchen_busy_preorder",
          message: buildKitchenBusyPreorderMessage({
            language: payload.language,
            estimatedWaitMinutes: preorderBusy.remainingEtaMinutes,
          }),
        },
        "kitchen_busy_preorder",
        mentalFirst,
        mental
      );
    }
  }

  if (
    !hasOrdered &&
    !isDismissed(dismissed, "kitchen_busy") &&
    (payload.sessionPhase === "browsing" || payload.sessionPhase === "latent")
  ) {
    const kitchenStation = input.venueOps?.stationStress?.find(
      (station) => station.station === "kitchen"
    );
    const busy = detectKitchenBusyTrigger({
      hasSessionOrders: Boolean(payload.hasSessionOrders),
      sessionPhase: payload.sessionPhase,
      kitchenPendingCount:
        payload.kitchenPendingCount ?? kitchenStation?.activeCount ?? 0,
      estimatedWaitMinutes:
        payload.kitchenEstimatedWaitMinutes ??
        input.opsEffects?.capacityBanner?.estimatedWaitMinutes ??
        kitchenStation?.avgWaitMinutes ??
        null,
      kdsStress: payload.kdsStress ?? input.venueOps?.kdsStress ?? null,
      isShown: () => isDismissed(dismissed, "kitchen_busy"),
    });
    if (busy) {
      pushCandidate(
        candidates,
        {
          kind: "kitchen_busy",
          message: buildKitchenBusyMessage({
            language: payload.language,
            estimatedWaitMinutes: busy.estimatedPrepMinutes,
            pendingCount: busy.kitchenBacklogPendingCount,
          }),
        },
        "kitchen_busy",
        mentalFirst,
        mental
      );
    }
  }

  if (config.proactive.slowKitchen && !isDismissed(dismissed, "slow_kitchen")) {
    const slow = detectSlowKitchenTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `slow_kitchen:${orderId}`) ||
        isDismissed(dismissed, "slow_kitchen"),
      now
    );
    if (slow?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "slow_kitchen",
          message: buildSlowKitchenMessage({
            language: payload.language,
            hasActiveDrinkOrder: hasActiveDrinkOrder(orders),
            waitMinutes: slow.waitMinutes,
            remainingEtaMinutes: slow.remainingEtaMinutes,
            estimatedPrepMinutes: slow.estimatedPrepMinutes,
            prepEstimateConfidence: slow.prepEstimateConfidence,
            delaySeverity: slow.delaySeverity,
            orderItemsLabel: slow.orderItemsLabel,
          }),
          orderId: slow.orderId,
        },
        "slow_kitchen",
        mentalFirst,
        mental
      );
    }
  }

  const slowKitchenSupersedesOrderIds = new Set(
    candidates
      .filter((row) => row.nudge.kind === "slow_kitchen" && row.nudge.orderId)
      .map((row) => row.nudge.orderId as string)
  );

  if (config.proactive.orderDelay && !isDismissed(dismissed, "order_preparing_notify")) {
    const preparingNotify = detectOrderPreparingNotifyTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `order_preparing_notify:${orderId}`) ||
        isDismissed(dismissed, "order_preparing_notify") ||
        isDismissed(dismissed, `order_eta_update:${orderId}`) ||
        isDismissed(dismissed, "order_eta_update")
    );
    if (preparingNotify?.orderId && !slowKitchenSupersedesOrderIds.has(preparingNotify.orderId)) {
      pushCandidate(
        candidates,
        {
          kind: "order_eta_update",
          message: buildOrderPreparingNotifyMessage({
            language: payload.language,
            remainingEtaMinutes: preparingNotify.remainingEtaMinutes,
            estimatedPrepMinutes: preparingNotify.estimatedPrepMinutes,
            orderItemsLabel: preparingNotify.orderItemsLabel,
          }),
          orderId: preparingNotify.orderId,
        },
        "order_preparing_notify",
        mentalFirst,
        mental
      );
    }
  }

  if (config.proactive.orderDelay && !isDismissed(dismissed, "order_eta_update")) {
    const etaUpdate = detectOrderEtaUpdateTrigger(
      orders,
      (orderId) =>
        slowKitchenSupersedesOrderIds.has(orderId) ||
        isDismissed(dismissed, `order_eta_update:${orderId}`) ||
        isDismissed(dismissed, "order_eta_update") ||
        isDismissed(dismissed, `order_delay:${orderId}`) ||
        isDismissed(dismissed, "order_delay") ||
        isDismissed(dismissed, `slow_kitchen:${orderId}`) ||
        isDismissed(dismissed, "slow_kitchen"),
      now,
      config.proactive.orderDelayMinutes
    );
    if (etaUpdate?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "order_eta_update",
          message: buildOrderEtaUpdateMessage({
            language: payload.language,
            remainingEtaMinutes: etaUpdate.remainingEtaMinutes,
            estimatedPrepMinutes: etaUpdate.estimatedPrepMinutes,
            orderItemsLabel: etaUpdate.orderItemsLabel,
            waitMinutes: etaUpdate.waitMinutes,
          }),
          orderId: etaUpdate.orderId,
        },
        "order_eta_update",
        mentalFirst,
        mental
      );
    }
  }

  const skipDessertWhileBrowsing =
    payload.sessionPhase === "browsing" && orders.length > 0;

  if (
    !isDismissed(dismissed, "dessert_nudge") &&
    !skipDessertWhileBrowsing &&
    !shouldSkipDessertForRevenueStrategy(input.revenueStrategy) &&
    shouldOfferDessert({ enforceMode, mentalFirst, mental })
  ) {
    const dessert =
      enforceMode && mental
        ? resolveEnforceDessertPosture({ orders, mental })
        : detectDessertTrigger(
            orders,
            () => isDismissed(dismissed, "dessert_nudge"),
            now,
            {
              minMinutes:
                payload.effectiveDessertDelayMinutes ??
                config.upsell.dessertDelayMinutes,
              maxMinutes: null,
              preparingMinMinutes:
                payload.effectiveDessertDelayMinutes ??
                config.upsell.dessertDelayMinutes,
            }
          );
    const suppressPreparingDessertWhileWaiting =
      payload.sessionPhase === "waiting" && Boolean(dessert?.orderId);
    if (dessert && !suppressPreparingDessertWhileWaiting) {
      const usePuzzleCopy =
        payload.puzzleProductName &&
        payload.dessertProductName?.trim() === payload.puzzleProductName.trim();
      const dessertCategory: MenuEngineeringCategory | undefined = usePuzzleCopy
        ? "puzzle"
        : undefined;

      pushCandidate(
        candidates,
        {
          kind: "dessert_nudge",
          message: usePuzzleCopy
            ? buildPuzzleNudgeMessage(
                payload.dessertProductName!,
                payload.language ?? "sr"
              )
            : buildDessertMessage(
                payload.dessertProductName,
                messages.dessert
              ),
          orderId: dessert.orderId,
          prompt: dessert.prompt,
        },
        "dessert",
        mentalFirst,
        mental,
        dessertCategory
      );
    }
  }

  if (
    config.proactive.billPrompt &&
    !isDismissed(dismissed, "bill_prompt") &&
    shouldOfferBillPrompt({
      enforceMode,
      mentalFirst,
      mental,
      idleMinutes,
      thresholdMinutes: config.proactive.billPromptMinutes,
      orders,
      now,
      sessionPhase: payload.sessionPhase,
    })
  ) {
    pushCandidate(
      candidates,
      { kind: "bill_prompt", message: messages.billPrompt },
      "bill",
      mentalFirst,
      mental
    );
  }

  if (
    payload.experienceScore != null &&
    payload.paidAnchorAt &&
    !isDismissed(dismissed, "google_review") &&
    !isDismissed(dismissed, "internal_feedback")
  ) {
    const review = detectReviewTrigger({
      orders,
      phase: payload.sessionPhase ?? "browsing",
      billSettled: Boolean(payload.billSettled),
      experienceScore: payload.experienceScore,
      frustrationLevel: mental?.affect.frustration.level ?? "none",
      googleReviewUrl: payload.googleReviewUrl ?? null,
      lastReviewPromptDate: payload.lastReviewPromptAt ?? null,
      lastReviewDismissDate: payload.lastReviewDismissAt ?? null,
      paidAnchorAt: payload.paidAnchorAt,
      language: payload.language,
      now,
      mealStage: mental?.mealStage ?? null,
      waitingForBill: payload.waitingForBill,
      tipRecorded: payload.tipRecorded,
      lastGuestMessage: payload.lastGuestMessage ?? null,
      kdsStress: payload.kdsStress,
      sessionDurationMinutes: payload.sessionDurationMinutes ?? null,
      recoveryCompleted: payload.recoveryCompleted,
      postRecoveryEligible: payload.postRecoveryEligible,
      guestAffect: mental?.affect ?? null,
      isShown: () =>
        isDismissed(dismissed, "google_review") ||
        isDismissed(dismissed, "internal_feedback"),
    });
    if (review) {
      pushCandidate(
        candidates,
        {
          kind: review.kind as GuestProactiveNudgeKind,
          message: review.prompt,
          orderId: review.orderId,
        },
        review.kind as GuestProactiveNudgeKind,
        mentalFirst,
        mental
      );
    }
  }

  const popularityEligible =
    config.proactive.popularityPairing &&
    !isDismissed(dismissed, "popularity_pair") &&
    payload.popularityPair &&
    shouldOfferPopularityPair({
      enforceMode,
      mentalFirst,
      mental,
      guestAskedRecommendation: Boolean(payload.guestAskedRecommendation),
      browseMinutes,
      thresholdMinutes: config.proactive.popularityBrowseMinutes,
      explicitPair: Boolean(payload.popularityPair),
    });

  if (popularityEligible) {
    pushCandidate(
      candidates,
      {
        kind: "popularity_pair",
        message: buildPopularityMessage(
          payload.popularityPair!,
          messages.popularityPair
        ),
      },
      "popularity",
      mentalFirst,
      mental,
      "star"
    );
  }

  for (const match of payload.adminUpsellMatches ?? []) {
    if (isDismissed(dismissed, match.dismissKey)) continue;
    const meCategory =
      input.menuEngineeringCategories?.[match.suggestProductId] ??
      payload.menuEngineeringCategories?.[match.suggestProductId];
    if (isMenuEngineeringBlocked(meCategory)) continue;
    if (config.upsell.respectDecline !== false) {
      const declineCount = dismissed.filter(
        (key) => key === match.dismissKey || key.startsWith(`${match.dismissKey}:`)
      ).length;
      if (declineCount >= 2) continue;
    }
    pushCandidate(
      candidates,
      {
        kind: "popularity_pair",
        message: match.message,
        prompt: `Owner upsell: suggest ${match.suggestProductName}`,
      },
      `admin_upsell:${match.ruleId}`,
      mentalFirst,
      mental,
      meCategory
    );
  }

  if (
    !hasOrdered &&
    input.browse &&
    config.proactive.enabled &&
    !popularityEligible
  ) {
    const categoryBrowse = detectCategoryBrowseNudge({
      browse: input.browse,
      hasOrdered,
      language: payload.language,
      nowMs: now,
    });
    if (categoryBrowse && !isDismissed(dismissed, "browse_nudge")) {
      pushBrowseCandidate(
        {
          kind: "browse_nudge",
          message: categoryBrowse.message,
          prompt: categoryBrowse.prompt,
        },
        `browse_category:${categoryBrowse.categoryId}`
      );
    }

    const dessertInterest = detectDessertCategoryInterest({
      browse: input.browse,
      hasOrdered: hasOrdered,
      language: payload.language,
    });
    if (dessertInterest && !isDismissed(dismissed, "browse_nudge")) {
      pushCandidate(
        candidates,
        {
          kind: "browse_nudge",
          message: dessertInterest.message,
          prompt: "Guest browsed desserts — suggest Tiramisu.",
        },
        "browse_dessert_interest",
        mentalFirst,
        mental
      );
    }

    const scrollTrigger = detectScrollInterestTrigger({
      browse: input.browse,
      dismissedKeys: dismissed,
    });
    if (scrollTrigger) {
      pushCandidate(
        candidates,
        {
          kind: scrollTrigger.kind,
          message: scrollTrigger.message,
        },
        "scroll_interest",
        mentalFirst,
        mental
      );
    }
  }

  if (
    !isDismissed(dismissed, "browse_nudge") &&
    !hasOrdered &&
    !cartRecoveryReady &&
    !popularityEligible &&
    shouldOfferBrowseNudge({
      enforceMode,
      mentalFirst,
      mental,
      browseMinutes,
      thresholdMinutes: config.proactive.browseNudgeMinutes,
    })
  ) {
    pushBrowseCandidate({ kind: "browse_nudge", message: messages.browse }, "browse");
  }

  if (!payload.hasDrinkInCart && !isDismissed(dismissed, "happy_hour_upsell")) {
    const happyHour = detectHappyHourUpsellTrigger({
      happyHourActive: payload.happyHourActive,
      sessionPhase: payload.sessionPhase,
      isShown: () => isDismissed(dismissed, "happy_hour_upsell"),
    });
    if (happyHour) {
      pushCandidate(
        candidates,
        {
          kind: "happy_hour_upsell",
          message: buildHappyHourUpsellMessage({ language: payload.language }),
          prompt: happyHour.prompt,
        },
        "happy_hour_upsell",
        mentalFirst,
        mental
      );
    }
  }

  if (!payload.hasDrinkInCart && !isDismissed(dismissed, "drink_refill")) {
    const sommelierRefill = detectSommelierRefillTrigger(orders, {
      hasDrinkInCart: payload.hasDrinkInCart,
      language: payload.language,
      now,
      isShown: (orderId) =>
        isDismissed(dismissed, `sommelier_refill:${orderId}`) ||
        isDismissed(dismissed, `drink_refill:${orderId}`) ||
        isDismissed(dismissed, "sommelier_refill") ||
        isDismissed(dismissed, "drink_refill"),
    });
    if (sommelierRefill?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "sommelier_refill",
          message: sommelierRefill.message,
          orderId: sommelierRefill.orderId,
          prompt: sommelierRefill.prompt,
        },
        "sommelier_refill",
        mentalFirst,
        mental
      );
    } else {
      const refill = detectDrinkRefillTrigger(orders, {
        hasDrinkInCart: payload.hasDrinkInCart,
        happyHourActive: payload.happyHourActive,
        now,
        isShown: (orderId) =>
          isDismissed(dismissed, `drink_refill:${orderId}`) ||
          isDismissed(dismissed, "drink_refill"),
      });
      if (refill?.orderId) {
        pushCandidate(
          candidates,
          {
            kind: "drink_refill",
            message: buildDrinkRefillMessage({
              language: payload.language,
              drinkName: refill.drinkName,
              happyHourActive: refill.happyHourActive,
            }),
            orderId: refill.orderId,
            prompt: refill.prompt,
          },
          "drink_refill",
          mentalFirst,
          mental
        );
      }
    }
  }

  const partySize = resolvePartySize(input.partyFacts);
  if (
    partySize != null &&
    partySize >= 2 &&
    !payload.hasDrinkInCart &&
    !isDismissed(dismissed, "party_drink_gap")
  ) {
    const drinkGap = detectPartyDrinkGapTrigger({
      orders,
      partySize,
      hasDrinkInCart: payload.hasDrinkInCart,
      isShown: () => isDismissed(dismissed, "party_drink_gap"),
    });
    if (drinkGap) {
      pushCandidate(
        candidates,
        {
          kind: "party_drink_gap",
          message: formatPartyDrinkGapMessage({ language: payload.language }),
          prompt: drinkGap.prompt,
        },
        "party_drink_gap",
        mentalFirst,
        mental
      );
    }
  }

  if (
    partySize != null &&
    !payload.hasDrinkInCart &&
    !isDismissed(dismissed, "round_two")
  ) {
    const roundTwo = detectRoundTwoTrigger({
      orders,
      partySize,
      hasDrinkInCart: payload.hasDrinkInCart,
      now,
      isShown: () => isDismissed(dismissed, "round_two"),
    });
    if (roundTwo) {
      pushCandidate(
        candidates,
        {
          kind: "round_two",
          message: buildRoundTwoMessage({
            language: payload.language,
            drinkName: roundTwo.suggestedRoundDrink,
            partySize: roundTwo.partySize,
          }),
          prompt: roundTwo.prompt,
        },
        "round_two",
        mentalFirst,
        mental
      );
    }
  }

  if (
    !payload.hasDrinkInCart &&
    !isDismissed(dismissed, "sommelier_pairing") &&
    !isDismissed(dismissed, "drink_with_food")
  ) {
    const sommelierPairing = detectSommelierFoodPairingTrigger(
      orders,
      (orderId) => isDrinkPairingDismissedForOrder(dismissed, orderId),
      now,
      {
        hasDrinkInCart: payload.hasDrinkInCart,
        sessionPhase: payload.sessionPhase,
        vkgDrinkName: payload.vkgDrinkPairing?.drinkName,
      }
    );
    if (sommelierPairing?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "sommelier_pairing",
          message: sommelierPairing.message,
          orderId: sommelierPairing.orderId,
          prompt: sommelierPairing.prompt,
        },
        "sommelier_pairing",
        mentalFirst,
        mental
      );
    }
  }

  if (
    !payload.hasDrinkInCart &&
    payload.vkgDrinkPairing?.drinkName &&
    !isDismissed(dismissed, "drink_with_food") &&
    !candidates.some((row) => row.nudge.kind === "sommelier_pairing")
  ) {
    const drinkWithFood = detectDrinkWithFoodTrigger(
      orders,
      (orderId) => isDrinkPairingDismissedForOrder(dismissed, orderId),
      now,
      {
        hasDrinkInCart: payload.hasDrinkInCart,
        vkgPairing: payload.vkgDrinkPairing,
      }
    );
    if (drinkWithFood?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "drink_with_food",
          message: buildDrinkWithFoodMessage({
            language: payload.language,
            foodName: drinkWithFood.foodName,
            drinkName: drinkWithFood.suggestedDrinkName,
            serveSize: drinkWithFood.serveSize,
          }),
          orderId: drinkWithFood.orderId,
          prompt: drinkWithFood.prompt,
        },
        "drink_with_food",
        mentalFirst,
        mental
      );
    }
  }

  if (
    !payload.hasDrinkInCart &&
    !isDismissed(dismissed, "drink_pairing") &&
    !candidates.some((row) => row.nudge.kind === "drink_with_food") &&
    !candidates.some((row) => row.nudge.kind === "sommelier_pairing")
  ) {
    const pairing = detectPairingTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `drink_pairing:${orderId}`) ||
        isDismissed(dismissed, "drink_pairing") ||
        isDismissed(dismissed, `sommelier_pairing:${orderId}`) ||
        isDismissed(dismissed, "sommelier_pairing"),
      now
    );
    if (pairing?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "drink_pairing",
          message: "",
          orderId: pairing.orderId,
          prompt: pairing.prompt,
        },
        "drink_pairing",
        mentalFirst,
        mental
      );
    }
  }

  const unavailableProductNames =
    input.venueOps?.unavailableProductNames?.filter(Boolean) ?? [];
  const inventoryBlocked = unavailableProductNames.length > 0;

  const inventoryFiltered = inventoryBlocked
    ? candidates.filter(
        (row) =>
          !shouldSkipProactiveForUnavailableProduct({
            nudgeKind: row.nudge.kind,
            message: row.nudge.message,
            unavailableProductNames,
          })
      )
    : candidates;

  const filtered =
    input.opsEffects?.suppressProactiveNudges === true
      ? inventoryFiltered.filter((row) =>
          shouldAllowEventProactiveNudge(row.nudge.kind, {
            suppressProactiveNudges: true,
            drinkPromptOnly: input.opsEffects?.drinkPromptOnly ?? false,
          })
        )
      : inventoryFiltered;

  const mentalFiltered = filterProactiveCandidatesByMentalModel({
    candidates: filtered,
    mental,
    enforce: isEnforceMode(config),
  });

  const slowKitchenOrderIds = new Set(
    mentalFiltered
      .filter((row) => row.nudge.kind === "slow_kitchen" && row.nudge.orderId)
      .map((row) => row.nudge.orderId as string)
  );

  const deduped =
    slowKitchenOrderIds.size === 0
      ? mentalFiltered
      : mentalFiltered.filter(
          (row) =>
            row.nudge.kind !== "order_eta_update" ||
            !row.nudge.orderId ||
            !slowKitchenOrderIds.has(row.nudge.orderId)
        );

  return deduped.sort((a, b) => b.priority - a.priority);
}
