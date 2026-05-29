import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
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
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";

export type CompileBeliefsInput = {
  state: TableSessionState;
  guestMessage: string;
  /** Sticky session language from request / ai_sessions. */
  sessionLanguage?: string | null;
  /** Override config when testing (defaults to state.config). */
  config?: ConciergeConfig;
  /** Override memory when testing (defaults to state.guest). */
  guestMemory?: GuestMemoryProjection | null;
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

const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|schnitzel|pils|espresso|latte)\b/i;

const SETTLING_GUEST_PATTERN =
  /\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat|pay|rechnung bitte|that's it|done ordering)\b/i;

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

function isCasualSocialMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  return !ORDERING_GUEST_PATTERN.test(text);
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

function resolveConversationMode(
  input: CompileBeliefsInput,
  pressure: CommercePressure,
  awaiting: ConversationAwaiting
): ReturnType<typeof belief<ConversationMode>> {
  const { state, guestMessage } = input;

  if (state.session.billSettled) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "settling",
      "inferred",
      0.95
    );
  }

  if (SETTLING_GUEST_PATTERN.test(guestMessage)) {
    return belief(
      CORE_BELIEF_KEYS.conversationMode,
      "settling",
      "inferred",
      0.9
    );
  }

  if (
    pressure !== "none" ||
    awaiting != null ||
    state.commerce.cart.visibleLines.length > 0
  ) {
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

  return belief(CORE_BELIEF_KEYS.conversationMode, "banter", "inferred", 0.75);
}

function resolvePendingSlot(
  state: TableSessionState,
  config: ConciergeConfig
): ReturnType<typeof belief<PendingSlotKind | null>> {
  if (!config.policy.requireServeSizeForDrinks) {
    return belief(CORE_BELIEF_KEYS.commercePendingSlot, null, "default", 1);
  }

  const missingServeSize = state.commerce.cart.ai.draft.items.some(
    (line) => !line.serveSize
  );

  if (missingServeSize) {
    return belief(
      CORE_BELIEF_KEYS.commercePendingSlot,
      "serve_size",
      "inferred",
      0.9
    );
  }

  return belief(CORE_BELIEF_KEYS.commercePendingSlot, null, "inferred", 0.85);
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
  config: ConciergeConfig
): ReturnType<typeof belief<boolean>> {
  const rush = state.venue.ops.operatingMode === "rush";
  const kdsStress = state.venue.ops.kdsStress === "high";
  const skip =
    state.venue.opsEffects.skipUpsell ||
    (rush && config.ops.rushSkipUpsell) ||
    (kdsStress && config.ops.kdsStressSkipUpsell);

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

/**
 * ADR-023 §3.2 — compile scored BeliefGraph after FOLD (MR-1).
 * Pure function — no timeline writes; caller appends `mind.beliefs_compiled`.
 */
export function compileBeliefs(input: CompileBeliefsInput): BeliefGraph {
  const config = input.config ?? input.state.config;
  const memory = input.guestMemory ?? input.state.guest;

  const pressureBelief = resolveCommercePressure(input.state);
  const pendingBelief = resolvePendingSlot(input.state, config);
  const awaitingBelief = resolveConversationAwaiting(
    input.state,
    config,
    pressureBelief.value
  );

  return beliefGraph([
    resolveConversationLanguage(input, config, memory),
    resolveConversationMode(input, pressureBelief.value, awaitingBelief.value),
    awaitingBelief,
    pendingBelief,
    pressureBelief,
    belief(
      CORE_BELIEF_KEYS.commerceAwaitingConfirm,
      pressureBelief.value === "confirm",
      "inferred",
      pressureBelief.value === "confirm" ? 0.95 : 0.9
    ),
    resolveVenueRush(input.state),
    resolveSkipUpsell(input.state, config),
    resolveReturnVisit(memory, config),
    resolveRequireConfirm(config),
  ]);
}
