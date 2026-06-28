import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
  type CommercePressure,
  type ConversationAwaiting,
  type ConversationMode,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import { synthesizeTurnInterpretationFromRouter } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";
import {
  classifyGuestIntent,
  isPureSocialBanterMessage,
  type GuestRoutedIntent,
} from "@/lib/denis/cognition/tde/semantic-intent-router";
import { isOrderPlacementMessage } from "@/lib/ai/ordering/order-message-backfill";

function normalizeGuestText(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function isVagueRecommendationRequest(message: string): boolean {
  const text = normalizeGuestText(message);
  if (!text) return false;
  return (
    /\b(preporuc|preporuci|recommend|empfehl|suggest|predlozi|predloz)\w*\b/i.test(
      text
    ) ||
    /\b(what should i (get|order|drink|try)|was soll ich (bestellen|nehmen|trinken))\b/i.test(
      text
    )
  );
}

function isMenuListingQuestion(message: string): boolean {
  const text = normalizeGuestText(message);
  if (!text) return false;
  if (isVagueRecommendationRequest(message)) return false;
  return (
    /\b(sta imate|shta imate|imate li|what do you have|was haben sie|show me)\b/i.test(
      text
    ) ||
    /\b(sta imate|shta imate)\s+\w+/i.test(text)
  );
}

export type GuestPostureMode = "relational" | "transactional";

const RELATIONAL_ROUTER_INTENTS: GuestRoutedIntent[] = [
  "smalltalk",
  "settling",
  "still_browsing",
  "promo_inquiry",
  "price_inquiry",
];

const TRANSACTIONAL_ROUTER_INTENTS: GuestRoutedIntent[] = [
  "order",
  "modification",
  "reorder",
  "round",
  "copy_order",
  "handoff",
  "preorder",
];

function hasHardCommercePressure(beliefs: BeliefGraph): boolean {
  const pressure = getBeliefValue<CommercePressure>(
    beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const pendingSlot = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );

  return (
    pressure === "open" ||
    pressure === "confirm" ||
    awaiting != null ||
    Boolean(pendingSlot)
  );
}

function isMenuDiscoveryQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\?/.test(text) ||
    /\b(koliko|ko[sš]ta|kosta|šta je|sta je|what is|how much|ima li|jel ima|je li|was ist|was kostet|kako se zove)\b/i.test(
      text
    )
  );
}

function isRelationalGuestTurn(
  message: string,
  interpretation: TurnInterpretation
): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;

  if (isMenuListingQuestion(trimmed)) {
    return false;
  }

  if (isMenuDiscoveryQuestion(trimmed) && !isOrderPlacementMessage(trimmed)) {
    return true;
  }

  if (isVagueRecommendationRequest(trimmed)) {
    return true;
  }

  const route = classifyGuestIntent(trimmed);
  const intent = route.intent;

  if (intent === "browse") {
    return isVagueRecommendationRequest(trimmed) && !isOrderPlacementMessage(trimmed);
  }

  if (RELATIONAL_ROUTER_INTENTS.includes(intent)) {
    return !isOrderPlacementMessage(trimmed);
  }

  if (isPureSocialBanterMessage(trimmed)) {
    return true;
  }

  if (
    interpretation.sentiment === "positive" &&
    (intent === "smalltalk" || intent === "settling")
  ) {
    return true;
  }

  return false;
}

/**
 * Relational vs transactional posture — L3 routing over beliefs + TurnInterpretation.
 * Menu-inquiry `conversation.mode=ordering` without cart is still relational.
 */
export function resolveGuestPostureMode(input: {
  beliefs: BeliefGraph;
  guestMessage?: string;
  interpretation?: TurnInterpretation | null;
}): GuestPostureMode {
  if (hasHardCommercePressure(input.beliefs)) {
    return "transactional";
  }

  const message = input.guestMessage?.trim() ?? "";
  const interpretation =
    input.interpretation ?? synthesizeTurnInterpretationFromRouter(message);
  const route = message ? classifyGuestIntent(message) : null;

  if (message && isRelationalGuestTurn(message, interpretation)) {
    return "relational";
  }

  if (route && TRANSACTIONAL_ROUTER_INTENTS.includes(route.intent)) {
    return "transactional";
  }

  if (message && isMenuListingQuestion(message)) {
    return "transactional";
  }

  const mode = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (mode === "ordering" && message && isOrderPlacementMessage(message)) {
    return "transactional";
  }

  return "relational";
}

export function hasGuestPostureCommercePressure(input: {
  beliefs: BeliefGraph;
  guestMessage?: string;
  interpretation?: TurnInterpretation | null;
}): boolean {
  return resolveGuestPostureMode(input) === "transactional";
}
