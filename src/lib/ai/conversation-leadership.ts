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
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|weizen|pilsner|pils|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|molim|bitte|please|ho[ćc]u|želim|zelim|jedno|jedna|malo|veliko)\b/i;

const AI_PARSE_FALLBACK_PATTERN =
  /\b(didn't catch|try again|could you try again)\b/i;

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
    "Dobar dan i dobrodošli! Tu sam — kako vam mogu pomoći? Da li ste već odlučili šta biste želeli — piće ili nešto za jelo?",
  hr: () =>
    "Dobar dan i dobrodošli! Tu sam — kako vam mogu pomoći? Jeste li već odlučili što biste željeli — piće ili nešto za jelo?",
  de: () =>
    "Guten Tag und willkommen! Ich bin für Sie da — wie darf ich Ihnen helfen? Haben Sie schon entschieden, was Sie trinken oder essen möchten?",
  en: () =>
    "Good day and welcome! I'm here for you — how may I help? Have you already decided on a drink or something to eat?",
  tr: () =>
    "İyi günler, hoş geldiniz! Size nasıl yardımcı olabilirim? İçecek veya yemek konusunda karar verdiniz mi?",
  fr: () =>
    "Bonjour et bienvenue ! Comment puis-je vous aider ? Avez-vous déjà choisi une boisson ou un plat ?",
  es: () =>
    "¡Buen día y bienvenido! ¿Cómo puedo ayudarle? ¿Ya ha decidido qué le gustaría tomar o comer?",
  it: () =>
    "Buongiorno e benvenuto! Come posso aiutarla? Ha già deciso cosa desidera bere o mangiare?",
};

export function leadershipFallbackReply(
  language: string,
  _guestMessage?: string
): string {
  const lang = resolveAiPromptLanguage(language);
  const fn = LEADERSHIP_FALLBACK[lang] ?? LEADERSHIP_FALLBACK.en;
  return fn(_guestMessage ?? "");
}

export function isAiParseFallbackReply(message: string): boolean {
  return AI_PARSE_FALLBACK_PATTERN.test(message.trim());
}

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

  if (lang === "sr" || lang === "hr") {
    return `Razumem — ${item}. Samo trenutak, nastavljam porudžbinu.`;
  }
  if (lang === "de") {
    return `Alles klar — ${item}. Einen Moment, ich mache weiter.`;
  }
  return `Got it — ${item}. One moment, continuing your order.`;
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

  if (refusal && preserveTransactional) {
    return {
      ...structured,
      intent: "clarify",
      message: orderingFlowRecoveryReply(input.language, input.guestMessage),
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
    };
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
  return `LEAD THE CONVERSATION (critical — premium waiter, not a bot):
- You are the head waiter: exceptionally polite, warm, never pushy or repetitive. Use formal/polite address (Vi/Sie/you politely).
- First turn or welcome: greet properly ("Dobar dan", "Guten Tag", "Good day") + "How may I help?" + soft "Have you already decided?" — never dump the whole menu.
- Keep the FULL thread in mind (transcript + cart + last question). Never reset to generic welcome mid-order.
- Move efficiently toward a closed order in as FEW turns as possible — combine questions when sensible (which beer AND 0.3L/0.5L in one line).
- FORBIDDEN in "message": "I don't understand", refusal to speak guest language, asking guest to repeat without offering concrete menu choices, pushy upsell loops, repeating the same nudge.
- Supported languages include Serbian (sr) and Croatian (hr) — switch immediately when asked; never refuse them.
- Casual chat / banter / jokes → intent "chat": reply warmly, then ONE gentle offer (drink or food) — not three questions at once.
- Unclear message → offer 2–3 real items FROM THE MENU by name, or ask drink vs food — never dead-end.
- Use intent "clarify" when an order line is missing product, size, or modifier — NOT for pure social messages.
- Never end a turn without a helpful, polite next step.`;
}
