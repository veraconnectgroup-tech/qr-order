import {
  resolveAiPromptLanguage,
  type AI_SUPPORTED_LANGUAGES,
} from "@/lib/ai/config";
import { isOrderPlacementMessage } from "@/lib/ai/ordering/order-message-backfill";
import type { AiConciergeIntent, AiStructuredResponse } from "@/lib/ai/types";

type AiLang = (typeof AI_SUPPORTED_LANGUAGES)[number];

/** Assistant replies that give up — Denis must never show these to guests. */
const REFUSAL_REPLY_PATTERN =
  /\b(verstehe nicht|versteh(?:e)? nicht ganz|kann(?:e)? nur (?:auf )?(?:deutsch|englisch)|nur (?:auf )?(?:deutsch|englisch)|don't understand|do not understand|didn't catch|can't speak|cannot speak|ne razumem|ne razumijem|izvinite ne razumem|sorry i don't|i'm sorry,? i (?:don't|can'?t)|entschuldigung,? ich verstehe)\b/i;

const LANGUAGE_REFUSAL_PATTERN =
  /\b(kann(?:e)? nur|can only answer|only (?:speak|answer in)|samo (?:nemacki|nemački|engleski))\b/i;

const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|weizen|pilsner|pils|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|molim|bitte|please|ho[ćc]u|želim|zelim|jedno|jedna|malo|veliko|dodaj|cevap|ćevap|pile[cć]i|kisela|čaj|caj|tea)\b/i;

const ORDER_CONTINUATION_PATTERN =
  /\b(nastavimo|nastavljamo|nastavi|gde\s+smo\s+stali|gdje\s+smo\s+stali|sta\s+sam\s+naruci[oó]|šta\s+sam\s+naruči[oó]|continue\s+(the\s+)?order|weiter\s+mit)\b/i;

const AI_PARSE_FALLBACK_PATTERN =
  /\b(didn't catch|try again|could you try again)\b/i;

const MISSING_ORDER_COMPLAINT_PATTERN =
  /\b(nisi poslao|nije poslat|not sent|keine bestellung|order.*not.*(sent|received)|konobar ka[žz]e)\b/i;

export function isDenisRefusalReply(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    REFUSAL_REPLY_PATTERN.test(text) ||
    LANGUAGE_REFUSAL_PATTERN.test(text) ||
    isAiParseFallbackReply(text)
  );
}

export function isGuestOrderingOrContinuationMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    isOrderPlacementMessage(text) ||
    ORDER_CONTINUATION_PATTERN.test(text) ||
    ORDERING_GUEST_PATTERN.test(text)
  );
}

/** Social / banter — not an order line missing a modifier. */
export function isCasualSocialGuestMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  if (ORDERING_GUEST_PATTERN.test(text)) return false;
  return true;
}

const ORDERING_INTENTS = new Set<AiConciergeIntent>(["order", "clarify", "confirm"]);

const LEADERSHIP_FALLBACK: Partial<
  Record<AiLang, (guestMessage: string) => string>
> & {
  en: (guestMessage: string) => string;
} = {
  sr: () =>
    "Tu sam — kako vam mogu pomoći? Da li ste već odlučili šta biste želeli — piće ili nešto za jelo?",
  hr: () =>
    "Tu sam — kako vam mogu pomoći? Jeste li već odlučili što biste željeli — piće ili nešto za jelo?",
  de: () =>
    "Ich bin für Sie da — wie darf ich Ihnen helfen? Haben Sie schon entschieden, was Sie trinken oder essen möchten?",
  en: () =>
    "I'm here for you — how may I help? Have you already decided on a drink or something to eat?",
  tr: () =>
    "Buradayım — size nasıl yardımcı olabilirim? İçecek veya yemek konusunda ne istersiniz?",
  fr: () =>
    "Je suis là — comment puis-je vous aider ? Avez-vous déjà choisi une boisson ou un plat ?",
  es: () =>
    "Estoy aquí — ¿cómo puedo ayudarle? ¿Ya ha decidido qué le gustaría tomar o comer?",
  it: () =>
    "Sono qui — come posso aiutarla? Ha già deciso cosa desidera bere o mangiare?",
};

function isOrderingStructuredIntent(intent: AiConciergeIntent): boolean {
  return ORDERING_INTENTS.has(intent);
}

/** Commerce-pressure refusal recovery — never reset to welcome. */
export function orderingContinueReply(language: string): string {
  const lang = resolveAiPromptLanguage(language);
  if (lang === "sr" || lang === "hr") {
    return "Hajde da nastavimo — šta želite da naručite?";
  }
  if (lang === "de") {
    return "Lassen Sie uns weitermachen — was möchten Sie bestellen?";
  }
  return "Let's continue — what would you like to order?";
}

/** First-turn / banter refusal — polite re-engage without welcome reset. */
export function politeReengageReply(language: string): string {
  const lang = resolveAiPromptLanguage(language);
  if (lang === "sr" || lang === "hr") {
    return "Tu sam — kako vam mogu pomoći? Recite mi šta biste želeli — piće ili nešto za jelo?";
  }
  if (lang === "de") {
    return "Ich bin für Sie da — wie darf ich Ihnen helfen? Was möchten Sie trinken oder essen?";
  }
  return "I'm here — how may I help? What would you like to drink or eat?";
}

function threadContinuationFallbackReply(
  language: string,
  guestMessage?: string
): string {
  const lang = resolveAiPromptLanguage(language);
  const guest = guestMessage?.trim().slice(0, 100);
  if (lang === "sr" || lang === "hr") {
    return guest
      ? `Razumem — ${guest}. Tu sam, kako vam mogu pomoći dalje?`
      : "Naravno, tu sam. Kako vam mogu pomoći dalje?";
  }
  if (lang === "de") {
    return guest
      ? `Alles klar — ${guest}. Wie darf ich Ihnen weiterhelfen?`
      : "Natürlich, ich bin da. Wie darf ich Ihnen weiterhelfen?";
  }
  return guest
    ? `Got it — ${guest}. I'm here — how may I help you next?`
    : "Sure, I'm here. How may I help you next?";
}

export function leadershipFallbackReply(
  language: string,
  guestMessage?: string,
  options?: { hasPriorMessages?: boolean }
): string {
  if (
    options?.hasPriorMessages ||
    isGuestOrderingOrContinuationMessage(guestMessage ?? "")
  ) {
    return threadContinuationFallbackReply(language, guestMessage);
  }
  const lang = resolveAiPromptLanguage(language);
  const fn = LEADERSHIP_FALLBACK[lang] ?? LEADERSHIP_FALLBACK.en;
  return fn(guestMessage ?? "");
}

export function isAiParseFallbackReply(message: string): boolean {
  return AI_PARSE_FALLBACK_PATTERN.test(message.trim());
}

const GUEST_DECIDED_PATTERN =
  /\b((jesam|sam)\s+odluč|već\s+sam\s+odluč|already\s+decided|schon\s+entschieden|ich\s+habe\s+entschieden)\b/i;

/** Mid-order recovery — never reset to welcome when guest is choosing items. */
export function orderingFlowRecoveryReply(
  language: string,
  guestMessage: string
): string {
  const lang = resolveAiPromptLanguage(language);
  const item = guestMessage.trim();
  if (!item) {
    return leadershipFallbackReply(language, guestMessage);
  }

  if (
    ORDER_CONTINUATION_PATTERN.test(item) ||
    /\b(sta\s+sam\s+naruci[oó]|šta\s+sam\s+naruči[oó])\b/i.test(item)
  ) {
    if (lang === "sr" || lang === "hr") {
      return "Naravno — recite mi šta još želite da dodam, ili potvrdite porudžbinu.";
    }
    if (lang === "de") {
      return "Natürlich — sagen Sie mir, was ich noch hinzufügen soll, oder bestätigen Sie die Bestellung.";
    }
    return "Sure — tell me what else to add, or confirm your order.";
  }

  if (GUEST_DECIDED_PATTERN.test(item)) {
    if (lang === "sr" || lang === "hr") {
      return "Super — recite mi šta želite, pa ću dodati u porudžbinu.";
    }
    if (lang === "de") {
      return "Sehr gut — sagen Sie mir, was Sie möchten, dann nehme ich es in die Bestellung auf.";
    }
    return "Great — tell me what you'd like and I'll add it to your order.";
  }

  // Never promise cart/submit work here — leadership only rewrites refusal copy.
  // Order comprehend + backfill run separately in the Denis act path.
  return threadContinuationFallbackReply(language, guestMessage);
}

export type ApplyConversationLeadershipInput = {
  language: string;
  guestMessage: string;
  /** ADR-030 — when set, never rewrite clarify to banter welcome. */
  context?: ConversationLeadershipContext;
};

export type ConversationLeadershipContext = {
  inOrderingFlow?: boolean;
  awaitingAnswer?: boolean;
  transactionalTurn?: boolean;
  /** Transcript already has guest/denis lines — never reset to welcome fallback. */
  hasPriorMessages?: boolean;
  /** ADR-025/030 — never rewrite refusal/clarify to banter welcome during commerce. */
  conversationMode?: "banter" | "ordering" | "settling";
  /** Explicit commerce pressure from beliefs — open cart or recap confirm. */
  commercePressure?: "none" | "open" | "confirm";
};

function hasCommercePressureOrAwaiting(
  ctx: ConversationLeadershipContext | undefined
): boolean {
  if (!ctx) return false;
  return (
    ctx.inOrderingFlow === true ||
    ctx.awaitingAnswer === true ||
    ctx.commercePressure === "open" ||
    ctx.commercePressure === "confirm"
  );
}

function isCommerceConversationContext(
  ctx: ConversationLeadershipContext | undefined
): boolean {
  if (!ctx) return false;
  return (
    hasCommercePressureOrAwaiting(ctx) ||
    ctx.transactionalTurn === true ||
    ctx.conversationMode === "ordering" ||
    ctx.conversationMode === "settling"
  );
}

function isOrderComplaintMessage(message: string): boolean {
  return MISSING_ORDER_COMPLAINT_PATTERN.test(message.trim());
}

function resolveRefusalRecoveryMessage(
  structured: AiStructuredResponse,
  input: ApplyConversationLeadershipInput
): string {
  const ctx = input.context;
  const orderingIntent = isOrderingStructuredIntent(structured.intent);

  if (hasCommercePressureOrAwaiting(ctx) || isCommerceConversationContext(ctx)) {
    return orderingContinueReply(input.language);
  }

  if (
    isOrderComplaintMessage(input.guestMessage) ||
    isGuestOrderingOrContinuationMessage(input.guestMessage) ||
    ctx?.hasPriorMessages
  ) {
    return orderingFlowRecoveryReply(input.language, input.guestMessage);
  }

  if (orderingIntent) {
    return politeReengageReply(input.language);
  }

  return politeReengageReply(input.language);
}

/**
 * Denis leads — never passive "I don't understand".
 * Rewrites refusal replies; preserves ordering/clarify/confirm during commerce (ADR-030).
 */
export function applyConversationLeadership(
  structured: AiStructuredResponse,
  input: ApplyConversationLeadershipInput
): AiStructuredResponse {
  if (!isDenisRefusalReply(structured.message)) {
    return structured;
  }

  const ctx = input.context;
  const orderingIntent = isOrderingStructuredIntent(structured.intent);
  const inCommerceContext =
    hasCommercePressureOrAwaiting(ctx) ||
    isCommerceConversationContext(ctx) ||
    isOrderComplaintMessage(input.guestMessage) ||
    isGuestOrderingOrContinuationMessage(input.guestMessage) ||
    Boolean(ctx?.hasPriorMessages);

  if (!inCommerceContext) {
    return {
      ...structured,
      intent: "chat",
      message: politeReengageReply(input.language),
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
    };
  }

  const intent = orderingIntent ? structured.intent : "clarify";

  return {
    ...structured,
    intent,
    message: resolveRefusalRecoveryMessage(structured, input),
    recommendations: [],
    proposedItems: [],
    quickReplies: [],
    submitOrder: false,
  };
}

/** Prompt block — Denis drives the table, never gives up. */
export function conversationLeadershipBlock(): string {
  return `LEAD THE CONVERSATION (critical — premium waiter, not a bot):
- You are the head waiter: exceptionally polite, warm, never pushy or repetitive. Use formal/polite address (Vi/Sie/you politely).
- First turn or welcome: greet properly ("Dobar dan", "Guten Tag", "Good day") + "How may I help?" + soft "Have you already decided?" — never dump the whole menu.
- Keep the FULL thread in mind (transcript + cart + last question). Never reset to generic welcome when transcript already has messages — continue naturally.
- If guest needs more time browsing, acknowledge briefly and say you will check back; do not push the menu.
- Move efficiently toward a closed order in as FEW turns as possible — combine questions when sensible (which beer AND 0.3L/0.5L in one line).
- FORBIDDEN in "message": "I don't understand", refusal to speak guest language, asking guest to repeat without offering concrete menu choices, pushy upsell loops, repeating the same nudge.
- Supported languages include Serbian (sr) and Croatian (hr) — switch immediately when asked; never refuse them.
- Casual chat / banter / jokes → intent "chat": reply warmly, then ONE gentle offer (drink or food) — not three questions at once.
- Unclear message → offer 2–3 real items FROM THE MENU by name, or ask drink vs food — never dead-end.
- Use intent "clarify" when an order line is missing product, size, or modifier — NOT for pure social messages.
- Never end a turn without a helpful, polite next step.`;
}
