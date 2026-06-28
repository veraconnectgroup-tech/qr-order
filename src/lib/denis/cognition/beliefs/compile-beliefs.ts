import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import {
  belief,
  beliefGraph,
  CORE_BELIEF_KEYS,
  type BeliefGraph,
  type CommercePressure,
  type ConversationAwaiting,
  type ConversationMode,
  type PendingSlotKind,
} from "@/lib/denis/cognition/beliefs/belief-types";
import {
  applyBeliefConfidencePipeline,
  type BeliefConflictLog,
} from "@/lib/denis/cognition/beliefs/belief-confidence";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import { obligationToBeliefs } from "@/lib/denis/cognition/waiter/assess-waiter-obligation";
import { mergeTableSessionObligation } from "@/lib/denis/cognition/waiter/merge-table-session-obligation";
import type { WaiterGapKind, WaiterNextAction } from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import { deriveCommerceLifecycleFacts } from "@/lib/denis/cognition/beliefs/compile-commerce-lifecycle";
import { isOrderPlacementMessage } from "@/lib/ai/ordering/order-message-backfill";

export type CompileBeliefsInput = {
  state: TableSessionState;
  guestMessage: string;
  /** Sticky session language from request / ai_sessions. */
  sessionLanguage?: string | null;
  /** Override config when testing (defaults to state.config). */
  config?: ConciergeConfig;
  /** Override memory when testing (defaults to state.guest). */
  guestMemory?: GuestMemoryProjection | null;
  nowMs?: number;
  rhythm?: ResolvedRhythmContext | null;
};

const SUPPORTED_LANGUAGES = [
  "de",
  "en",
  "sr",
  "hr",
  "tr",
  "fr",
  "es",
  "it",
  "ru",
  "ar",
] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const EXPLICIT_LANGUAGE_PREFERENCE: Array<{
  pattern: RegExp;
  lang: SupportedLanguage;
}> = [
  {
    pattern:
      /\b(serbisch|serbian|srpski|na srpskom|samo srpski|samo na srpskom|auf serbisch|nur (auf )?serbisch|weiter (nur )?(auf )?serbisch|continue in serbian|in serbian)\b/i,
    lang: "sr",
  },
  {
    pattern: /\b(croatian|hrvatski|na hrvatskom|auf kroatisch)\b/i,
    lang: "hr",
  },
  {
    pattern: /\b(auf deutsch|in german|nur deutsch|continue in german)\b/i,
    lang: "de",
  },
  {
    pattern: /\b(in english|auf englisch|only english|nur englisch)\b/i,
    lang: "en",
  },
];

const LATIN_BALKAN_PATTERN =
  /\b(jedn[auo]|molim|hvala|naru[čc]|poru[čc]|potvrd|donesi|donij|imam|alergij|pivo|cola|kola|jo[sš]|sve|nema|mo[žz]e|moze|želim|zelim|ho[ćc]u|hocu|imate|zdravo|dobar|gde|gdje|sta|šta|kako|si|ste|sam|smo|brate|bre|legendo|legend|ćao|cao|jel|jesi|nisi|reci|recite|ajde|idem|idemo|super|odlično|odlicno|samo|sad|sada|kasnije|hajde|izvini|izvinite|naravno|važi|vazi|može|moze)\b/i;

const LATIN_GERMAN_PATTERN =
  /\b(bitte|danke|ein|eine|einen|einem|gross|groß|klein|bier|wasser|wein|cola|kaffee|tee|ich|möchte|mochte|hätte|hatte|bestellen|rechnung|kellner|hallo|guten|morgen|tag|abend|gerne|wollen|würde|wurde|noch|alles|spritz|pilsner|lager|weizen|radler)\b/i;

const LATIN_ENGLISH_PATTERN =
  /\b(please|thanks|thank you|could i|can i|i want|i'd like|allergies|order|hello|hi)\b/i;

const SETTLING_GUEST_PATTERN =
  /\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat|pay|rechnung bitte|that's it|done ordering)\b/i;

const MENU_INQUIRY_PATTERN =
  /(šta imate|sta imate|what do you have|was habt ihr|šta nudite|imate li)/i;

const NEUTRAL_LANGUAGE_MESSAGE =
  /^(0[,.]3|0[,.]5|0[,.]33|1|2)(\s*(l|liter|litre|litr))?$/i;

function normalizeLanguageCode(language: string): SupportedLanguage {
  const code = language.trim().toLowerCase().slice(0, 2);
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
    return code as SupportedLanguage;
  }
  return "en";
}

function detectExplicitLanguagePreference(
  message: string
): SupportedLanguage | null {
  for (const row of EXPLICIT_LANGUAGE_PREFERENCE) {
    if (row.pattern.test(message)) return row.lang;
  }
  return null;
}

function detectMessageLanguage(
  message: string,
  venueDefault: string
): { lang: SupportedLanguage; confidence: number; source: "explicit" | "inferred" } {
  const text = message.trim();
  const venue = normalizeLanguageCode(venueDefault);

  const explicit = detectExplicitLanguagePreference(text);
  if (explicit) {
    return { lang: explicit, confidence: 1, source: "explicit" };
  }

  if (!text) {
    return { lang: venue, confidence: 0.7, source: "inferred" };
  }

  if (/[\u0600-\u06FF]/.test(text)) {
    return { lang: "ar", confidence: 0.95, source: "inferred" };
  }
  if (/[ђЂјЈљЉњЊћЋ]/.test(text)) {
    return {
      lang: venue === "hr" ? "hr" : "sr",
      confidence: 0.95,
      source: "inferred",
    };
  }
  if (/[\u0400-\u04FF]/.test(text)) {
    return { lang: "ru", confidence: 0.95, source: "inferred" };
  }
  if (/[ğüşöçıİĞÜŞÖÇ]/.test(text)) {
    return { lang: "tr", confidence: 0.95, source: "inferred" };
  }
  if (/[äöüßÄÖÜ]/.test(text)) {
    return { lang: "de", confidence: 0.95, source: "inferred" };
  }
  if (/[àâçéèêëïîôùûüœæ]/i.test(text)) {
    return { lang: "fr", confidence: 0.95, source: "inferred" };
  }
  if (/[ñ¿¡]/i.test(text)) {
    return { lang: "es", confidence: 0.95, source: "inferred" };
  }

  const lower = text.toLowerCase();
  if (LATIN_BALKAN_PATTERN.test(lower)) {
    if (venue === "hr") return { lang: "hr", confidence: 0.9, source: "inferred" };
    return { lang: "sr", confidence: 0.9, source: "inferred" };
  }
  if (LATIN_GERMAN_PATTERN.test(lower)) {
    return { lang: "de", confidence: 0.85, source: "inferred" };
  }
  if (LATIN_ENGLISH_PATTERN.test(lower)) {
    return { lang: "en", confidence: 0.85, source: "inferred" };
  }

  return { lang: venue, confidence: 0.55, source: "inferred" };
}

function isLanguageNeutralMessage(message: string): boolean {
  const text = message.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text || text.length > 48) return false;
  return (
    NEUTRAL_LANGUAGE_MESSAGE.test(text) ||
    /^(da|ja|yes|yep|yeah|ok|okay|okej|potvrdi|pošalji|posalji|send|confirm)([\s,.!]|$)/.test(
      text
    ) ||
    /^(molim|hvala|thanks?|thank you|bitte|danke)([\s,.!]|$)/.test(text)
  );
}

function resolveConversationLanguage(
  input: CompileBeliefsInput,
  config: ConciergeConfig,
  memory: GuestMemoryProjection | null | undefined
): ReturnType<typeof belief<string>> {
  const venueDefault = config.language.venueDefault;

  if (!config.language.followGuest) {
    return belief(
      CORE_BELIEF_KEYS.conversationLanguage,
      normalizeLanguageCode(venueDefault),
      "default",
      1
    );
  }

  const explicitPref = detectExplicitLanguagePreference(input.guestMessage);
  if (explicitPref) {
    return belief(
      CORE_BELIEF_KEYS.conversationLanguage,
      explicitPref,
      "explicit",
      1
    );
  }

  if (
    memory?.preferredLanguage &&
    config.memory.returnGuestEnabled &&
    isLanguageNeutralMessage(input.guestMessage)
  ) {
    return belief(
      CORE_BELIEF_KEYS.conversationLanguage,
      normalizeLanguageCode(memory.preferredLanguage),
      "memory",
      0.9
    );
  }

  if (isLanguageNeutralMessage(input.guestMessage) && input.sessionLanguage) {
    return belief(
      CORE_BELIEF_KEYS.conversationLanguage,
      normalizeLanguageCode(input.sessionLanguage),
      "inferred",
      0.85
    );
  }

  const detected = detectMessageLanguage(input.guestMessage, venueDefault);
  return belief(
    CORE_BELIEF_KEYS.conversationLanguage,
    detected.lang,
    detected.source,
    detected.confidence
  );
}

/** Narrow pure-social greeting — relational tier only (ADR-030). */
const PURE_SOCIAL_BANTER_PATTERN =
  /^(zdravo|ćao|cao|hello|hi|hey|guten tag|guten abend|merhaba|que tal|ciao|hola)[\s,!.-]*((kako si|how are|sta si|sta ima|legendo|legend).*)?$/i;

export function isPureSocialBanterMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 120) return false;
  return PURE_SOCIAL_BANTER_PATTERN.test(text);
}

function resolveCommercePressure(
  state: TableSessionState
): ReturnType<typeof belief<CommercePressure>> {
  const flowNodeId = state.conversation.flowNodeId;
  const cartLines = state.commerce.cart.visibleLines.length;
  const openOrders = state.commerce.orders.some(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  const confirmFlow: FlowNodeId[] = ["recap", "submit"];

  if (confirmFlow.includes(flowNodeId) && cartLines > 0) {
    return belief(
      CORE_BELIEF_KEYS.commercePressure,
      "confirm",
      "inferred",
      0.95
    );
  }

  if (cartLines > 0 || openOrders) {
    return belief(CORE_BELIEF_KEYS.commercePressure, "open", "inferred", 0.9);
  }

  return belief(CORE_BELIEF_KEYS.commercePressure, "none", "default", 0.85);
}

function resolveConversationAwaiting(
  state: TableSessionState,
  config: ConciergeConfig,
  pressure: CommercePressure
): ReturnType<typeof belief<ConversationAwaiting>> {
  const foldedAwaiting = state.conversation.model?.awaiting ?? null;
  if (
    foldedAwaiting &&
    pressure !== "confirm" &&
    !state.conversation.pendingSlot
  ) {
    return belief(
      CORE_BELIEF_KEYS.conversationAwaiting,
      foldedAwaiting,
      "inferred",
      0.88
    );
  }

  if (pressure === "confirm") {
    return belief(
      CORE_BELIEF_KEYS.conversationAwaiting,
      "confirm",
      "inferred",
      0.92
    );
  }

  const pending = resolvePendingSlot(state, config);
  if (pending.value) {
    return belief(
      CORE_BELIEF_KEYS.conversationAwaiting,
      pending.value as ConversationAwaiting,
      "inferred",
      0.9
    );
  }

  return belief(CORE_BELIEF_KEYS.conversationAwaiting, null, "default", 0.9);
}

function hasStickyCommerceSession(
  state: TableSessionState,
  pressure: CommercePressure,
  awaiting: ConversationAwaiting
): boolean {
  return (
    pressure !== "none" ||
    awaiting != null ||
    state.commerce.cart.visibleLines.length > 0 ||
    state.commerce.orders.some(
      (order) => order.status !== "delivered" && order.status !== "cancelled"
    ) ||
    state.conversation.pendingSlot != null
  );
}

function resolveConversationMode(
  input: CompileBeliefsInput,
  pressure: CommercePressure,
  awaiting: ConversationAwaiting
): ReturnType<typeof belief<ConversationMode>> {
  const { state, guestMessage } = input;
  const stickyCommerce = hasStickyCommerceSession(state, pressure, awaiting);

  if (state.session.billSettled) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "settling",
      "inferred",
      0.95
    );
  }

  if (SETTLING_GUEST_PATTERN.test(guestMessage)) {
    const hasUnsentCart =
      state.commerce.cart.visibleLines.length > 0 ||
      state.conversation.pendingSlot != null;

    if (hasUnsentCart) {
      return belief(
        CORE_BELIEF_KEYS.conversationMode,
        "ordering",
        "inferred",
        0.92
      );
    }

    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "settling",
      "inferred",
      0.9
    );
  }

  if (stickyCommerce) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "ordering",
      "inferred",
      0.9
    );
  }

  const awaitingServeSize =
    (input.config ?? input.state.config).policy.requireServeSizeForDrinks &&
    state.commerce.cart.ai.draft.items.some((line) => !line.serveSize);

  if (awaitingServeSize) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "ordering",
      "inferred",
      0.9
    );
  }

  if (isOrderPlacementMessage(guestMessage.trim())) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "ordering",
      "inferred",
      0.88
    );
  }

  if (MENU_INQUIRY_PATTERN.test(guestMessage.trim())) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "ordering",
      "inferred",
      0.85
    );
  }

  return belief(CORE_BELIEF_KEYS.conversationMode, "banter", "inferred", 0.75);
}

function resolvePendingSlot(
  state: TableSessionState,
  config: ConciergeConfig
): ReturnType<typeof belief<PendingSlotKind | null>> {
  if (!config.policy.requireServeSizeForDrinks) {
    return belief(CORE_BELIEF_KEYS.commercePendingSlot, null, "default", 1);
  }

  if (state.conversation.pendingSlot) {
    return belief(
      CORE_BELIEF_KEYS.commercePendingSlot,
      state.conversation.pendingSlot,
      "inferred",
      0.95
    );
  }

  const missingDrinkServeSize = state.commerce.cart.ai.draft.items.some(
    (line) =>
      (line.menuSection === "drinks" ||
        /\b(pivo|beer|bier|cola|kola|weizen|pilsner|sprite)\b/i.test(
          line.productName
        )) &&
      !line.serveSize?.trim()
  );

  if (missingDrinkServeSize) {
    return belief(
      CORE_BELIEF_KEYS.commercePendingSlot,
      "serve_size",
      "inferred",
      0.9
    );
  }

  return belief(CORE_BELIEF_KEYS.commercePendingSlot, null, "inferred", 0.85);
}

function resolveHasOpenOrders(
  state: TableSessionState
): ReturnType<typeof belief<boolean>> {
  const open = state.commerce.orders.some(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  return belief(
    CORE_BELIEF_KEYS.commerceHasOpenOrders,
    open,
    "inferred",
    open ? 0.95 : 0.9
  );
}

function resolveHasDeliveredOrders(
  state: TableSessionState
): ReturnType<typeof belief<boolean>> {
  const delivered = state.commerce.orders.some(
    (order) => order.status === "delivered"
  );
  return belief(
    CORE_BELIEF_KEYS.commerceHasDeliveredOrders,
    delivered,
    "inferred",
    delivered ? 0.95 : 0.9
  );
}

function resolveCommerceLifecycleBeliefs(
  state: TableSessionState,
  nowMs = Date.now()
) {
  const facts = deriveCommerceLifecycleFacts(
    state.commerce.orders,
    state.venue.ops,
    nowMs
  );
  const openCount = state.commerce.orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  ).length;

  return [
    belief(CORE_BELIEF_KEYS.commerceAnyLate, facts.anyLate, "inferred", 0.85),
    belief(
      CORE_BELIEF_KEYS.commerceOldestWaitMinutes,
      facts.oldestWaitMinutes,
      "inferred",
      openCount ? 0.85 : 0.6
    ),
    belief(
      CORE_BELIEF_KEYS.commerceKitchenEta,
      facts.kitchenEtaMinutes,
      "ops",
      0.75
    ),
    belief(CORE_BELIEF_KEYS.commerceBarEta, facts.barEtaMinutes, "ops", 0.75),
  ];
}

function resolveRhythmBeliefs(rhythm: ResolvedRhythmContext | null | undefined) {
  const topProducts = rhythm?.topProductSummaries?.length
    ? rhythm.topProductSummaries
        .map((product) => `${product.name} (${product.sharePct}%)`)
        .join(", ")
    : null;

  return [
    belief(
      CORE_BELIEF_KEYS.venueCurrentSlotStress,
      rhythm?.currentSlotStress ?? null,
      rhythm?.active ? "ops" : "default",
      rhythm?.confidence ?? 0.5
    ),
    belief(
      CORE_BELIEF_KEYS.venueTypicalSessionMinutes,
      rhythm?.typicalSessionMinutes ?? null,
      rhythm?.active ? "ops" : "default",
      rhythm?.confidence ?? 0.5
    ),
    belief(
      CORE_BELIEF_KEYS.venueTopProducts,
      topProducts,
      rhythm?.active ? "ops" : "default",
      rhythm?.confidence ?? 0.5
    ),
  ];
}

function resolvePartyBeliefs(state: TableSessionState) {
  return [
    belief(
      CORE_BELIEF_KEYS.partySize,
      state.party?.activeDeviceCount ?? 1,
      state.party ? "inferred" : "default",
      state.party ? 0.85 : 0.6
    ),
    belief(
      CORE_BELIEF_KEYS.partyMode,
      state.party?.partyMode ?? null,
      state.party ? "inferred" : "default",
      state.party ? 0.85 : 0.6
    ),
  ];
}

function resolveVenueRush(
  state: TableSessionState
): ReturnType<typeof belief<boolean>> {
  const rush = state.venue.ops.operatingMode === "rush";
  return belief(
    CORE_BELIEF_KEYS.venueRush,
    rush,
    "ops",
    rush ? 0.95 : 0.9
  );
}

function resolveSkipUpsell(
  state: TableSessionState,
  config: ConciergeConfig,
  rhythm?: ResolvedRhythmContext | null
): ReturnType<typeof belief<boolean>> {
  const rush = state.venue.ops.operatingMode === "rush";
  const kdsStress = state.venue.ops.kdsStress === "high";
  const rhythmSkip =
    rhythm?.mode === "enforce" &&
    rhythm?.behaviorDirectives?.skipUpsell === true &&
    (rhythm.currentSlotStress === "rush" ||
      rhythm.currentSlotStress === "high" ||
      rhythm.currentSlotStress === "busy");
  const skip =
    state.venue.opsEffects.skipUpsell ||
    (rush && config.ops.rushSkipUpsell) ||
    (kdsStress && config.ops.kdsStressSkipUpsell) ||
    rhythmSkip;

  return belief(
    CORE_BELIEF_KEYS.venueSkipUpsell,
    skip,
    "ops",
    skip ? 0.95 : 0.85
  );
}

function resolveReturnVisit(
  memory: GuestMemoryProjection | null | undefined,
  config: ConciergeConfig
): ReturnType<typeof belief<boolean>> {
  if (!config.memory.returnGuestEnabled || !memory) {
    return belief(CORE_BELIEF_KEYS.guestReturnVisit, false, "default", 0.9);
  }

  const isReturn = memory.visitCount > 1 || Boolean(memory.lastVisitAt);
  return belief(
    CORE_BELIEF_KEYS.guestReturnVisit,
    isReturn,
    "memory",
    isReturn ? 0.95 : 0.8
  );
}

function resolveRequireConfirm(
  config: ConciergeConfig
): ReturnType<typeof belief<boolean>> {
  return belief(
    CORE_BELIEF_KEYS.policyRequireConfirm,
    config.ordering.requireExplicitConfirm,
    "default",
    1
  );
}

function resolveOfferBeliefs(state: TableSessionState) {
  const { offer, browse } = state;
  const confidence =
    offer.hash && offer.hash !== "empty" ? 0.9 : 0.5;
  const browseFocus =
    browse.viewedProducts[0]?.productId ??
    offer.scoredProducts[0]?.productId ??
    null;

  return [
    belief(
      CORE_BELIEF_KEYS.offerPrimaryProductId,
      offer.primary?.productId ?? null,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.offerPrimaryProductName,
      offer.primary?.productName ?? null,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.offerAlternativeProductName,
      offer.alternative?.productName ?? null,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.offerResolution,
      offer.primary?.resolution ?? null,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.offerReadinessReady,
      offer.readiness.ready,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.offerPrimaryKitchenBlocked,
      offer.primary?.isKitchenBlocked ?? false,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.mentalBrowseFocusProduct,
      browseFocus,
      "inferred",
      browseFocus ? 0.85 : 0.5
    ),
  ];
}

function resolveMentalBeliefs(state: TableSessionState) {
  const mental = state.mental;
  const confidence = mental.confidence > 0 ? mental.confidence : 0.75;

  return [
    belief(
      CORE_BELIEF_KEYS.mentalIntent,
      mental.intent,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.mentalReceptiveness,
      mental.receptiveness,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.mentalFrustration,
      mental.affect.frustration.level,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.mentalPredictedNeed,
      mental.predictedNeed,
      "inferred",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.mentalPriceAffinity,
      mental.priceAffinity,
      "inferred",
      confidence
    ),
  ];
}

/**
 * ADR-023 §3.2 — compile scored BeliefGraph after FOLD (MR-1).
 * Pure function — no timeline writes; caller appends `mind.beliefs_compiled`.
 */
function resolveWaiterObligationBeliefs(input: CompileBeliefsInput) {
  const config = input.config ?? input.state.config;
  const atRecap =
    input.state.conversation.flowNodeId === "recap" ||
    input.state.conversation.flowNodeId === "submit";

  const obligation = mergeTableSessionObligation({
    state: input.state,
    source: "turn",
    guestMessage: input.guestMessage,
    language: input.sessionLanguage ?? config.language?.venueDefault ?? "sr",
    atRecap,
  });

  const facts = obligationToBeliefs(obligation);

  return {
    obligation,
    beliefs: [
      belief(CORE_BELIEF_KEYS.waiterGapCount, facts.gapCount, "inferred", 0.95),
      belief(
        CORE_BELIEF_KEYS.waiterCanConfirm,
        facts.canConfirm,
        "inferred",
        facts.canConfirm ? 0.95 : 0.98
      ),
      belief(
        CORE_BELIEF_KEYS.waiterPrimaryGap,
        facts.primaryGap,
        "inferred",
        facts.primaryGap ? 0.92 : 0.85
      ),
      belief(
        CORE_BELIEF_KEYS.waiterNextAction,
        facts.nextAction,
        "inferred",
        0.9
      ),
    ] as Array<
      ReturnType<typeof belief<number>> |
        ReturnType<typeof belief<boolean>> |
        ReturnType<typeof belief<WaiterGapKind | null>> |
        ReturnType<typeof belief<WaiterNextAction>>
    >,
  };
}

function resolveGuestAllergies(
  memory: GuestMemoryProjection | null | undefined
): ReturnType<typeof belief<string[]>> | null {
  const labels = memory?.allergyLabels ?? [];
  if (labels.length === 0) return null;
  return belief(
    CORE_BELIEF_KEYS.guestAllergies,
    labels,
    memory ? "memory" : "default",
    1,
    { observedAtMs: memory?.lastVisitAt ? Date.parse(memory.lastVisitAt) : undefined }
  );
}

function buildObservedAtMap(
  input: CompileBeliefsInput,
  explicitLanguage: boolean
): Record<string, number> {
  const now = input.nowMs ?? Date.now();
  const mentalAt = input.state.mental.computedAt || now;
  const map: Record<string, number> = {
    [CORE_BELIEF_KEYS.mentalIntent]: mentalAt,
    [CORE_BELIEF_KEYS.mentalReceptiveness]: mentalAt,
    [CORE_BELIEF_KEYS.mentalFrustration]: mentalAt,
    [CORE_BELIEF_KEYS.mentalPredictedNeed]: mentalAt,
    [CORE_BELIEF_KEYS.mentalPriceAffinity]: mentalAt,
    [CORE_BELIEF_KEYS.conversationMode]: now,
    [CORE_BELIEF_KEYS.commercePressure]: now,
  };

  if (!explicitLanguage) {
    map[CORE_BELIEF_KEYS.conversationLanguage] = mentalAt;
  } else {
    map[CORE_BELIEF_KEYS.conversationLanguage] = now;
  }

  const browseFocus = input.state.browse.viewedProducts[0]?.lastViewedAt;
  if (browseFocus) {
    map[CORE_BELIEF_KEYS.mentalBrowseFocusProduct] = Date.parse(browseFocus);
  }

  return map;
}

export function compileBeliefs(input: CompileBeliefsInput): BeliefGraph {
  const config = input.config ?? input.state.config;
  const memory = input.guestMemory ?? input.state.guest;
  const explicitLanguage = Boolean(
    detectExplicitLanguagePreference(input.guestMessage)
  );

  const pressureBelief = resolveCommercePressure(input.state);
  const pendingBelief = resolvePendingSlot(input.state, config);
  const awaitingBelief = resolveConversationAwaiting(
    input.state,
    config,
    pressureBelief.value
  );
  const waiterBeliefs = resolveWaiterObligationBeliefs(input);
  const guestAllergies = resolveGuestAllergies(memory);

  const rawGraph = beliefGraph([
    resolveConversationLanguage(input, config, memory),
    resolveConversationMode(input, pressureBelief.value, awaitingBelief.value),
    awaitingBelief,
    pendingBelief,
    pressureBelief,
    belief(
      CORE_BELIEF_KEYS.commerceAwaitingConfirm,
      pressureBelief.value === "confirm",
      "inferred",
      pressureBelief.value === "confirm" ? 0.95 : 0.9,
      { observedAtMs: input.nowMs ?? Date.now() }
    ),
    resolveVenueRush(input.state),
    resolveSkipUpsell(input.state, config, input.rhythm),
    resolveReturnVisit(memory, config),
    resolveRequireConfirm(config),
    resolveHasOpenOrders(input.state),
    resolveHasDeliveredOrders(input.state),
    ...(guestAllergies ? [guestAllergies] : []),
    ...resolveCommerceLifecycleBeliefs(input.state, input.nowMs),
    ...resolveRhythmBeliefs(input.rhythm),
    ...resolvePartyBeliefs(input.state),
    ...resolveMentalBeliefs(input.state),
    ...resolveOfferBeliefs(input.state),
    ...waiterBeliefs.beliefs,
  ]);

  const conflictLog: BeliefConflictLog[] = [];
  return applyBeliefConfidencePipeline({
    graph: rawGraph,
    nowMs: input.nowMs,
    observedAtMap: buildObservedAtMap(input, explicitLanguage),
    conflictLog,
  });
}
