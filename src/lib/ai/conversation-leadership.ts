import {
  resolveAiPromptLanguage,
  type AI_SUPPORTED_LANGUAGES,
} from "@/lib/ai/config";
import type { AiConciergeIntent, AiStructuredResponse } from "@/lib/ai/types";

type AiLang = (typeof AI_SUPPORTED_LANGUAGES)[number];

/** Assistant replies that give up — Denis must never show these to guests. */
const REFUSAL_REPLY_PATTERN =
  /\b(verstehe nicht|versteh(?:e)? nicht ganz|kann(?:e)? nur (?:auf )?(?:deutsch|englisch)|nur (?:auf )?(?:deutsch|englisch)|don't understand|do not understand|didn't catch|can't speak|cannot speak|ne razumem|ne razumijem|izvinite ne razumem|sorry i don't|i'm sorry,? i (?:don't|can'?t)|entschuldigung,? ich verstehe)\b/i;

const LANGUAGE_REFUSAL_PATTERN =
  /\b(kann(?:e)? nur|can only answer|only (?:speak|answer in)|samo (?:nemacki|nemački|engleski))\b/i;

const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l)\b/i;

const MISSING_ORDER_COMPLAINT_PATTERN =
  /\b(nisi poslao|nije poslat|not sent|keine bestellung|order.*not.*(sent|received)|konobar ka[žz]e)\b/i;

export function isDenisRefusalReply(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return REFUSAL_REPLY_PATTERN.test(text) || LANGUAGE_REFUSAL_PATTERN.test(text);
}

/** Social / banter — not an order line missing a modifier. */
export function isCasualSocialGuestMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  if (ORDERING_GUEST_PATTERN.test(text)) return false;
  return true;
}

const LEADERSHIP_FALLBACK: Partial<
  Record<AiLang, (guestMessage: string) => string>
> & {
  en: (guestMessage: string) => string;
} = {
  sr: () =>
    "Tu sam! Reci šta želiš — piće, jelo, ili da ti nešto preporučim sa menija?",
  hr: () =>
    "Tu sam! Reci što želiš — piće, jelo, ili da ti nešto preporučim s jelovnika?",
  de: () =>
    "Ich bin da! Was darf ich bringen — Getränk, Essen, oder eine Empfehlung vom Menu?",
  en: () =>
    "I'm here! What can I get you — a drink, something to eat, or a menu pick?",
  tr: () => "Buradayım! İçecek, yemek veya menüden bir öneri ister misin?",
  fr: () =>
    "Je suis là ! Une boisson, un plat, ou une suggestion du menu ?",
  es: () => "¡Aquí estoy! ¿Bebida, comida o una recomendación del menú?",
  it: () => "Sono qui! Da bere, da mangiare o un consiglio dal menu?",
};

export function leadershipFallbackReply(
  language: string,
  _guestMessage?: string
): string {
  const lang = resolveAiPromptLanguage(language);
  const fn = LEADERSHIP_FALLBACK[lang] ?? LEADERSHIP_FALLBACK.en;
  return fn(_guestMessage ?? "");
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
};

function shouldPreserveClarify(input: ApplyConversationLeadershipInput): boolean {
  const ctx = input.context;
  if (!ctx) return false;
  return (
    ctx.inOrderingFlow === true ||
    ctx.awaitingAnswer === true ||
    ctx.transactionalTurn === true
  );
}

function isOrderComplaintMessage(message: string): boolean {
  return MISSING_ORDER_COMPLAINT_PATTERN.test(message.trim());
}

/**
 * Denis leads — never passive "I don't understand".
 * Rewrites refusal replies; preserves LLM clarify during ordering (ADR-030).
 */
export function applyConversationLeadership(
  structured: AiStructuredResponse,
  input: ApplyConversationLeadershipInput
): AiStructuredResponse {
  const refusal = isDenisRefusalReply(structured.message);
  const preserveClarify = shouldPreserveClarify(input);
  const preserveTransactional =
    preserveClarify || isOrderComplaintMessage(input.guestMessage);
  const misclassifiedClarify =
    !preserveTransactional &&
    structured.intent === "clarify" &&
    isCasualSocialGuestMessage(input.guestMessage) &&
    structured.proposedItems.length === 0 &&
    structured.recommendations.length === 0;

  if (!refusal && !misclassifiedClarify) {
    return structured;
  }

  const intent: AiConciergeIntent =
    refusal || misclassifiedClarify ? "chat" : structured.intent;

  return {
    ...structured,
    intent,
    message: leadershipFallbackReply(input.language, input.guestMessage),
    recommendations: [],
    proposedItems: [],
    quickReplies: [],
    submitOrder: false,
  };
}

/** Prompt block — Denis drives the table, never gives up. */
export function conversationLeadershipBlock(): string {
  return `LEAD THE CONVERSATION (critical — Denis drives, guest follows):
- You are the head waiter in charge. Always move forward: drink → food → confirm → send.
- FORBIDDEN in "message": "I don't understand", "Entschuldigung ich verstehe nicht", "ne razumem", "I can only speak German/English", asking the guest to repeat without offering choices.
- Supported languages include Serbian (sr) and Croatian (hr) — switch immediately when asked; never refuse them.
- Casual chat / banter / jokes ("gde si", "legend", thanks, small talk) → intent "chat": reply warmly in the guest's language, then ONE soft nudge (drink, food, or recommendation).
- Unclear message → do NOT give up: offer two concrete menu choices or ask "drink or food?" — never dead-end.
- Use intent "clarify" ONLY when an order line is missing required size/modifier — NOT for social messages.
- Never end a turn without a helpful next step for the guest.`;
}
