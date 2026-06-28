import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type {
  BrowseSequenceEntry,
  BrowseSequencePattern,
  OfferReadiness,
  ResolvedOffer,
} from "@/lib/denis/cognition/offer/offer-types";
import type { VenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/types";
import {
  safeForAllergies,
  substituteFor,
} from "@/lib/denis/kernel/vkg/queries";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type CartAbandonReason =
  | "price_shock"
  | "allergy_concern"
  | "replaced"
  | "indecisive"
  | "group_veto"
  | "distraction"
  | "confusion"
  | "unknown";

export type SmartRecoveryAction =
  | "offer_alternative"
  | "offer_same_later"
  | "skip"
  | "offer_with_discount_hint";

export type SmartRecoveryPlan = {
  reason: CartAbandonReason;
  action: SmartRecoveryAction;
  delaySeconds: number;
  message: string | null;
  /** When action is offer_alternative — cheaper or safer substitute. */
  alternativeProductId?: string | null;
  alternativeProductName?: string | null;
};

export type CartAbandonedItem = GuestBrowseProfile["cartAbandoned"][number];

export type CartAction = BrowseSequenceEntry & {
  action: "add_to_cart" | "remove_from_cart";
};

export type AnalyzeCartAbandonInput = {
  abandonedItem: CartAbandonedItem;
  browseAfterRemove: BrowseSequenceEntry[];
  mental: GuestMentalModel;
  allCartActions: CartAction[];
  viewedProducts: GuestBrowseProfile["viewedProducts"];
  sequencePattern?: BrowseSequencePattern;
  productPricesCents?: Record<string, number>;
  sessionAllergieLabels?: string[];
  productAllergens?: Record<string, string[]>;
  vkgGraph?: VenueKnowledgeGraph | null;
  cartRecoveryEmitCount?: number;
  secondsSinceRemove?: number;
  language?: string | null;
};

const MAX_CART_RECOVERY_PER_SESSION = 1;
export { MAX_CART_RECOVERY_PER_SESSION };
const PRICE_SHOCK_RATIO = 0.85;
const INDECISIVE_DELAY_SEC = 60;
const DEFAULT_SAME_ITEM_DELAY_SEC = 30;
export const DISTRACTION_DELAY_SEC = 600;
export const CONFUSION_DELAY_SEC = 120;
export const FULL_CART_MIN_ITEMS = 1;

function isEnglish(language: string | null | undefined): boolean {
  return (language?.trim().toLowerCase() ?? "sr").startsWith("en");
}

function parseMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function sliceBrowseAfterRemove(
  sequence: BrowseSequenceEntry[],
  removedAt: string
): BrowseSequenceEntry[] {
  const removedMs = parseMs(removedAt);
  if (removedMs <= 0) return sequence;
  return sequence.filter((entry) => parseMs(entry.at) >= removedMs);
}

export function filterCartActions(
  sequence: BrowseSequenceEntry[]
): CartAction[] {
  return sequence.filter(
    (entry): entry is CartAction =>
      entry.action === "add_to_cart" || entry.action === "remove_from_cart"
  );
}

function productNameForId(
  productId: string,
  viewedProducts: GuestBrowseProfile["viewedProducts"]
): string {
  return (
    viewedProducts.find((row) => row.productId === productId)?.productName ??
    productId
  );
}

function detectReplaced(input: AnalyzeCartAbandonInput): boolean {
  const removedMs = parseMs(input.abandonedItem.removedAt);
  return input.allCartActions.some(
    (action) =>
      action.action === "add_to_cart" &&
      parseMs(action.at) > removedMs &&
      action.productId !== input.abandonedItem.productId
  );
}

function detectAllergyConcern(input: AnalyzeCartAbandonInput): boolean {
  const labels = input.sessionAllergieLabels ?? [];
  if (labels.length === 0) return false;

  const productAllergens =
    input.productAllergens?.[input.abandonedItem.productId] ?? [];
  if (productAllergens.length === 0) return false;

  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  return productAllergens.some((allergen) =>
    normalizedLabels.has(allergen.toLowerCase())
  );
}

function detectPriceShockAlternative(input: AnalyzeCartAbandonInput): {
  productId: string;
  productName: string;
} | null {
  const prices = input.productPricesCents;
  if (!prices) return null;

  const abandonedPrice = prices[input.abandonedItem.productId];
  if (abandonedPrice == null || abandonedPrice <= 0) return null;

  for (const entry of input.browseAfterRemove) {
    if (entry.action !== "view_product" || !entry.productId) continue;
    if (entry.productId === input.abandonedItem.productId) continue;

    const candidatePrice = prices[entry.productId];
    if (candidatePrice == null) continue;
    if (candidatePrice >= abandonedPrice * PRICE_SHOCK_RATIO) continue;

    return {
      productId: entry.productId,
      productName: productNameForId(entry.productId, input.viewedProducts),
    };
  }

  if (
    input.sequencePattern === "price_sensitive" &&
    input.mental.priceAffinity === "budget"
  ) {
    const cheaperView = input.browseAfterRemove.find(
      (entry) =>
        entry.action === "view_product" &&
        entry.productId &&
        entry.productId !== input.abandonedItem.productId
    );
    if (cheaperView?.productId) {
      return {
        productId: cheaperView.productId,
        productName: productNameForId(
          cheaperView.productId,
          input.viewedProducts
        ),
      };
    }
  }

  return null;
}

function isIdleAfterRemove(browseAfterRemove: BrowseSequenceEntry[]): boolean {
  return !browseAfterRemove.some(
    (entry) => entry.action === "view_product" || entry.action === "add_to_cart"
  );
}

function buildAlternativeMessage(input: {
  abandonedName: string;
  alternativeName: string;
  english: boolean;
}): string {
  if (input.english) {
    return `If ${input.abandonedName} felt a bit much — ${input.alternativeName} is a great lighter pick. Shall I add it?`;
  }
  return `Ako vam je ${input.abandonedName} bilo previše — ${input.alternativeName} je odlična lakša opcija. Hoćete da dodam?`;
}

function buildSameItemLaterMessage(productName: string, english: boolean): string {
  if (english) {
    return `Still thinking about ${productName}? I can add it whenever you're ready.`;
  }
  return `Još uvek razmišljate o ${productName}? Mogu da dodam kad budete spremni.`;
}

function buildAllergySafeMessage(input: {
  abandonedName: string;
  alternativeName: string;
  english: boolean;
}): string {
  if (input.english) {
    return `${input.abandonedName} may not fit your allergies — ${input.alternativeName} is a safe alternative. Shall I add it?`;
  }
  return `${input.abandonedName} možda ne odgovara vašim alergijama — ${input.alternativeName} je bezbedna alternativa. Hoćete da dodam?`;
}

function resolveAllergySafeAlternative(input: AnalyzeCartAbandonInput): {
  productId: string;
  productName: string;
} | null {
  const labels = input.sessionAllergieLabels ?? [];
  if (labels.length === 0) return null;

  if (input.vkgGraph) {
    const substitutes = substituteFor(input.vkgGraph, input.abandonedItem.productId, {
      limit: 5,
    });
    const safeIds = new Set(
      safeForAllergies(
        input.vkgGraph,
        labels,
        substitutes.map((row) => row.productId)
      )
    );
    const match = substitutes.find((row) => safeIds.has(row.productId));
    if (match) {
      return { productId: match.productId, productName: match.name };
    }
  }

  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  for (const entry of input.browseAfterRemove) {
    if (entry.action !== "view_product" || !entry.productId) continue;
    if (entry.productId === input.abandonedItem.productId) continue;

    const allergens = input.productAllergens?.[entry.productId] ?? [];
    const conflict = allergens.some((allergen) =>
      normalizedLabels.has(allergen.toLowerCase())
    );
    if (!conflict) {
      return {
        productId: entry.productId,
        productName: productNameForId(entry.productId, input.viewedProducts),
      };
    }
  }

  return null;
}

function buildDiscountHintMessage(productName: string, english: boolean): string {
  if (english) {
    return `${productName} is one of our guest favorites — want me to add it back?`;
  }
  return `${productName} je među omiljenim kod gostiju — hoćete da vam ga vratim u korpu?`;
}

function buildDistractionMessage(input: {
  itemCount: number;
  english: boolean;
}): string {
  if (input.english) {
    return `You still have ${input.itemCount} item${input.itemCount === 1 ? "" : "s"} in your cart — shall I help you finish the order?`;
  }
  return `Još uvek imate ${input.itemCount} stavk${input.itemCount === 1 ? "u" : "e"} u korpi — hoćete da završimo narudžbinu?`;
}

function buildConfusionMessage(english: boolean): string {
  if (english) {
    return "Tap the cart icon, review your items, then confirm — I can walk you through it.";
  }
  return "Dodirnite ikonicu korpe, proverite stavke i potvrdite — mogu da vas vodim korak po korak.";
}

export type AnalyzeFullCartAbandonInput = {
  itemCount: number;
  subtotal: number;
  idleMs: number;
  viewedCheckout: boolean;
  mental: GuestMentalModel;
  cartRecoveryEmitCount?: number;
  expectedBudgetCents?: number | null;
  language?: string | null;
};

/** Full-cart abandon — distraction (forgot) vs confusion (checkout stuck) vs price shock. */
export function analyzeFullCartAbandon(
  input: AnalyzeFullCartAbandonInput
): SmartRecoveryPlan {
  const english = isEnglish(input.language);

  if ((input.cartRecoveryEmitCount ?? 0) >= MAX_CART_RECOVERY_PER_SESSION) {
    return {
      reason: "unknown",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  if (input.itemCount < FULL_CART_MIN_ITEMS) {
    return {
      reason: "unknown",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  if (input.mental.groupDynamics.mode === "party") {
    return {
      reason: "group_veto",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  const idleSec = Math.max(0, input.idleMs / 1000);

  if (
    input.expectedBudgetCents != null &&
    input.expectedBudgetCents > 0 &&
    input.subtotal * 100 > input.expectedBudgetCents * 1.15
  ) {
    return {
      reason: "price_shock",
      action: "offer_with_discount_hint",
      delaySeconds: DEFAULT_SAME_ITEM_DELAY_SEC,
      message: english
        ? "The total looks a bit higher than expected — want a lighter option?"
        : "Ukupan iznos deluje veći nego što ste očekivali — hoćete nešto povoljnije?",
    };
  }

  if (input.viewedCheckout && idleSec >= CONFUSION_DELAY_SEC) {
    return {
      reason: "confusion",
      action: "offer_same_later",
      delaySeconds: CONFUSION_DELAY_SEC,
      message: buildConfusionMessage(english),
    };
  }

  if (idleSec >= DISTRACTION_DELAY_SEC) {
    return {
      reason: "distraction",
      action: "offer_same_later",
      delaySeconds: DISTRACTION_DELAY_SEC,
      message: buildDistractionMessage({
        itemCount: input.itemCount,
        english,
      }),
    };
  }

  return {
    reason: "unknown",
    action: "skip",
    delaySeconds: 0,
    message: null,
  };
}

/** Smart cart recovery — reason, timing, and copy before proactive emit. */
export function analyzeCartAbandon(
  input: AnalyzeCartAbandonInput
): SmartRecoveryPlan {
  const english = isEnglish(input.language);

  if ((input.cartRecoveryEmitCount ?? 0) >= MAX_CART_RECOVERY_PER_SESSION) {
    return {
      reason: "unknown",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  if (input.mental.groupDynamics.mode === "party") {
    return {
      reason: "group_veto",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  if (detectAllergyConcern(input)) {
    const safeAlternative = resolveAllergySafeAlternative(input);
    if (safeAlternative) {
      return {
        reason: "allergy_concern",
        action: "offer_alternative",
        delaySeconds: DEFAULT_SAME_ITEM_DELAY_SEC,
        message: buildAllergySafeMessage({
          abandonedName: input.abandonedItem.productName,
          alternativeName: safeAlternative.productName,
          english,
        }),
        alternativeProductId: safeAlternative.productId,
        alternativeProductName: safeAlternative.productName,
      };
    }
    return {
      reason: "allergy_concern",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  if (detectReplaced(input)) {
    return {
      reason: "replaced",
      action: "skip",
      delaySeconds: 0,
      message: null,
    };
  }

  const priceAlternative = detectPriceShockAlternative(input);
  if (priceAlternative) {
    return {
      reason: "price_shock",
      action: "offer_alternative",
      delaySeconds: DEFAULT_SAME_ITEM_DELAY_SEC,
      message: buildAlternativeMessage({
        abandonedName: input.abandonedItem.productName,
        alternativeName: priceAlternative.productName,
        english,
      }),
      alternativeProductId: priceAlternative.productId,
      alternativeProductName: priceAlternative.productName,
    };
  }

  if (
    input.mental.pace === "indecisive" &&
    isIdleAfterRemove(input.browseAfterRemove)
  ) {
    return {
      reason: "indecisive",
      action: "offer_same_later",
      delaySeconds: INDECISIVE_DELAY_SEC,
      message: buildSameItemLaterMessage(input.abandonedItem.productName, english),
    };
  }

  if (input.mental.priceAffinity === "budget") {
    return {
      reason: "price_shock",
      action: "offer_with_discount_hint",
      delaySeconds: DEFAULT_SAME_ITEM_DELAY_SEC,
      message: buildDiscountHintMessage(input.abandonedItem.productName, english),
    };
  }

  return {
    reason: "unknown",
    action: "offer_same_later",
    delaySeconds: DEFAULT_SAME_ITEM_DELAY_SEC,
    message: buildSameItemLaterMessage(input.abandonedItem.productName, english),
  };
}

export function countCartRecoveryEmits(input: {
  outcomes: Array<{ nudgeKind: string }>;
  pending: Array<{ nudgeKind: string }>;
}): number {
  const emitted = input.outcomes.filter(
    (row) => row.nudgeKind === "cart_recovery"
  ).length;
  const pending = input.pending.filter(
    (row) => row.nudgeKind === "cart_recovery"
  ).length;
  return emitted + pending;
}

export function recoveryDelayOpen(
  plan: SmartRecoveryPlan,
  secondsSinceRemove: number
): boolean {
  if (plan.action === "skip") return false;
  if (plan.delaySeconds <= 0) return true;
  return secondsSinceRemove >= plan.delaySeconds;
}

export function isCartRecoveryOfferStrategy(strategy: string): boolean {
  return (
    strategy === "cart_recovery_first" ||
    strategy === "cart_recovery_price_alt" ||
    strategy === "cart_recovery_discount_hint"
  );
}

/** Map browse timeline rows to sequence entries with product names for tests. */
export function browseEventsToSequence(
  events: BrowseEvent[]
): BrowseSequenceEntry[] {
  return events.map((event) => ({
    at: event.timestamp,
    action: event.action,
    productId: event.productId,
    categoryId: event.categoryId,
    menuSection: event.menuSection ?? null,
    dwellMs: event.dwellMs,
  }));
}

function isBrowsePerceptionRow(row: DenisTimelineRow): BrowseEvent | null {
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { type?: string }).type !== "perception.ingested") return null;

  const frame = (payload as { frame?: { channel?: string } }).frame;
  if (frame?.channel !== "telemetry.browse") return null;

  const event = (payload as { browseEvent?: BrowseEvent }).browseEvent;
  if (!event || typeof event !== "object") return null;
  return event;
}

/** Build price map (cents) from add_to_cart line totals in browse telemetry. */
export function buildProductPricesFromTimeline(
  timeline: DenisTimelineRow[]
): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const row of timeline) {
    const event = isBrowsePerceptionRow(row);
    if (!event?.productId || event.lineTotal == null) continue;
    if (event.action !== "add_to_cart") continue;
    prices[event.productId] = Math.round(event.lineTotal * 100);
  }
  return prices;
}

export function buildProductAllergensFromVkg(
  graph: VenueKnowledgeGraph | null | undefined
): Record<string, string[]> {
  if (!graph) return {};
  const allergens: Record<string, string[]> = {};
  for (const [productId, product] of Object.entries(graph.products)) {
    allergens[productId] = product.allergens;
  }
  return allergens;
}

function toResolvedOffer(input: {
  productId: string;
  productName: string;
  resolution: ResolvedOffer["resolution"];
  score: number;
  isKitchenBlocked?: boolean;
}): ResolvedOffer {
  return {
    productId: input.productId,
    productName: input.productName,
    categoryId: null,
    resolution: input.resolution,
    score: input.score,
    dedupeKey: `offer:${input.resolution}:${input.productId}`,
    isKitchenBlocked: input.isKitchenBlocked ?? false,
  };
}

function strategyForPlan(plan: SmartRecoveryPlan): string {
  if (plan.action === "offer_alternative") {
    return plan.reason === "allergy_concern"
      ? "cart_recovery_price_alt"
      : "cart_recovery_price_alt";
  }
  if (plan.action === "offer_with_discount_hint") {
    return "cart_recovery_discount_hint";
  }
  if (plan.action === "offer_same_later") {
    return "cart_recovery_first";
  }
  return "posture_no_offer";
}

export type ResolveSmartCartRecoveryInput = {
  browse: GuestBrowseProfile;
  mental: GuestMentalModel;
  sequence: BrowseSequenceEntry[];
  sequencePattern: BrowseSequencePattern;
  readiness: OfferReadiness;
  cartRecoveryEmitCount: number;
  productPricesCents?: Record<string, number>;
  sessionAllergieLabels?: string[];
  productAllergens?: Record<string, string[]>;
  vkgGraph?: VenueKnowledgeGraph | null;
  language?: string | null;
  nowMs: number;
  isKitchenBlocked?: boolean;
};

export type SmartCartRecoveryResolution = {
  plan: SmartRecoveryPlan;
  primary: ResolvedOffer | null;
  cartRecovery: ResolvedOffer | null;
  alternative: ResolvedOffer | null;
  strategy: string;
  readiness: OfferReadiness;
};

/** Fold-time cart recovery — maps abandon telemetry to offer + proactive candidate. */
export function resolveSmartCartRecoveryOffer(
  input: ResolveSmartCartRecoveryInput
): SmartCartRecoveryResolution | null {
  const abandoned = input.browse.cartAbandoned[0];
  if (!abandoned) return null;

  const cartHesitationReady =
    input.readiness.reason === "cart_hesitation" ||
    (input.mental.predictedNeed === "needs_help_choosing" &&
      input.browse.cartAbandoned.length > 0);

  if (!cartHesitationReady) return null;

  const removedMs = parseMs(abandoned.removedAt);
  const secondsSinceRemove =
    removedMs > 0 ? Math.max(0, (input.nowMs - removedMs) / 1000) : 0;

  const allCartActions = filterCartActions(input.sequence);
  const browseAfterRemove = sliceBrowseAfterRemove(input.sequence, abandoned.removedAt);

  const plan = analyzeCartAbandon({
    abandonedItem: abandoned,
    browseAfterRemove,
    allCartActions,
    mental: input.mental,
    viewedProducts: input.browse.viewedProducts,
    sequencePattern: input.sequencePattern,
    productPricesCents: input.productPricesCents,
    sessionAllergieLabels: input.sessionAllergieLabels,
    productAllergens: input.productAllergens,
    vkgGraph: input.vkgGraph,
    cartRecoveryEmitCount: input.cartRecoveryEmitCount,
    secondsSinceRemove,
    language: input.language,
  });

  const readiness: OfferReadiness = {
    ready: plan.action !== "skip",
    reason: "cart_hesitation",
    secondsSinceLastBrowseAction: input.readiness.secondsSinceLastBrowseAction,
  };

  if (plan.action === "skip") {
    return {
      plan,
      primary: null,
      cartRecovery: null,
      alternative: null,
      strategy: "cart_recovery_skipped",
      readiness: { ...readiness, ready: false },
    };
  }

  const kitchenBlocked = input.isKitchenBlocked ?? false;
  const strategy = strategyForPlan(plan);

  if (plan.action === "offer_alternative" && plan.alternativeProductId) {
    const target = toResolvedOffer({
      productId: plan.alternativeProductId,
      productName:
        plan.alternativeProductName ??
        productNameForId(plan.alternativeProductId, input.browse.viewedProducts),
      resolution: "cart_recovery",
      score: 0.88,
      isKitchenBlocked: kitchenBlocked,
    });
    return {
      plan,
      primary: target,
      cartRecovery: target,
      alternative: null,
      strategy,
      readiness,
    };
  }

  const sameItem = toResolvedOffer({
    productId: abandoned.productId,
    productName: abandoned.productName,
    resolution: "cart_recovery",
    score: 0.85,
    isKitchenBlocked: kitchenBlocked,
  });

  return {
    plan,
    primary: sameItem,
    cartRecovery: sameItem,
    alternative: null,
    strategy,
    readiness,
  };
}

export function isCartRecoveryCandidateReady(
  offer: {
    smartRecovery: SmartRecoveryPlan | null;
    readiness: OfferReadiness;
    trace: { strategy: string };
  } | null
  | undefined,
  secondsSinceRemove: number
): boolean {
  if (!offer?.smartRecovery) return false;
  if (offer.smartRecovery.action === "skip") return false;
  if (!offer.readiness.ready) return false;
  if (!isCartRecoveryOfferStrategy(offer.trace.strategy)) return false;
  return recoveryDelayOpen(offer.smartRecovery, secondsSinceRemove);
}
