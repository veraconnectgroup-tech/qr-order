import {
  emptyOrderDraft,
  type AiOrderDraft,
} from "@/lib/ai/ordering/draft-types";
import type { AiConciergeIntent } from "@/lib/ai/types";

type MenuLanguage = "de" | "en" | "sr" | "hr";

function normalizeMessage(message: string) {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

export function summarizeDraftOrder(draft: AiOrderDraft): string {
  return draft.items
    .map(
      (item) =>
        `${item.quantity}× ${item.productName}${item.serveSize ? ` ${item.serveSize}` : ""}`
    )
    .join(", ");
}

/** Guest-facing recap line — qty 1 omits "1×" (Pilsner 0.5L). */
export function formatOrderRecapLine(
  item: AiOrderDraft["items"][number]
): string {
  const size = item.serveSize ? ` ${item.serveSize}` : "";
  if (item.quantity === 1) {
    return `${item.productName}${size}`.trim();
  }
  return `${item.quantity}× ${item.productName}${size}`.trim();
}

export function formatOrderRecapLines(draft: AiOrderDraft): string[] {
  return draft.items.map(formatOrderRecapLine);
}

function recapQuestion(lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return "Ist das alles?";
    case "en":
      return "Is that everything?";
    case "hr":
      return "Je li to sve?";
    case "sr":
      return "Da li je to sve?";
    default:
      return "Da li je to sve?";
  }
}

function confirmOrderMessage(draft: AiOrderDraft, lang: MenuLanguage): string {
  const lines = formatOrderRecapLines(draft);
  return [recapQuestion(lang), ...lines].join("\n");
}

export function isGuestDecliningMore(message: string): boolean {
  const text = normalizeMessage(message);
  if (isGuestAbandoningOrder(message)) return false;
  return (
    /^(ne+hvala|ne hvala|ne, hvala|ne treba|nije potrebno|ne mora|ne želim|ne zelim)$/.test(
      text
    ) ||
    /^(nein danke|nein, danke|danke nein|no thanks?|nope|nicht|ne\.?)$/.test(
      text
    ) ||
    /^ne(,|$)/.test(text)
  );
}

/** Guest backs out of the whole order — clear cart, do not repeat recap. */
export function isGuestAbandoningOrder(message: string): boolean {
  const text = normalizeMessage(message);
  return (
    /\b(odustao|odustala|odustajem|predomislio|predomislim|ipak\s+ne|ipak\s+ni[šs]ta|ne\s+[ćc]u\s+(ni[šs]ta|nista)(\s+da\s+poru[čc]|\s+poru[čc]iti)?|ne\s+(želim|zelim)\s+da\s+poru[čc]|ne\s+(želim|zelim)\s+(ni[šs]ta|nista)\s+poru[čc]|ni[šs]ta\s+ne\s+[ćc]u)\b/.test(
      text
    ) ||
    /\b(cancel|abbrechen|changed my mind|give up|don't want to order|do not want to order)\b/.test(
      text
    )
  );
}

export function isGuestDoneOrdering(message: string): boolean {
  const text = normalizeMessage(message);
  return (
    /ne?\s*to je sve|to je sve|samo to|to je to|sve hvala|gotovo/.test(text) ||
    /ništa više|nista vise|ništa drugo|nista drugo|nema ništa|nema nista/.test(
      text
    ) ||
    /das war(\s+)?('|)s|das reicht|nichts mehr|nur das|fertig|sonst nichts/.test(
      text
    ) ||
    /that('s| is) all|nothing else|just that|no more|all set/.test(text)
  );
}

/** Flow-control replies — handle without LLM when cart already has items. */
export function shouldHandleOrderFlowWithoutLlm(
  message: string,
  draft: AiOrderDraft
): boolean {
  if (draft.items.length === 0 || draft.pending) return false;

  if (isGuestDoneOrdering(message)) return true;

  // At recap, confirm goes through LLM comprehend — not regex skip (ADR-030).

  if (draft.flow?.foodUpsellAsked && isGuestDecliningMore(message)) {
    return true;
  }

  return false;
}

export function isGuestFinalConfirm(message: string): boolean {
  const text = normalizeMessage(message);
  return (
    /^(da|ja|yes|yep|ok+|potvrdi|potvrdjujem|potvrđujem|potvrdjeno|potvrđeno|bestätigen|bestätige|confirm|pošalji|posalji|send|bestellen|naruči|naruci)([\s,.!]|$)/.test(
      text
    ) ||
    /^(da|ja),?\s*(pošalji|posalji|potvrdi|potvrdjujem|potvrđujem|bestätigen|send|naruči|naruci)/.test(
      text
    )
  );
}

function asksAboutFood(message: string): boolean {
  return /essen|jelo|food|something to eat|etwas zu essen|noch etwas|još nešto|jos nesto|anything else to eat|želite li nešto za jelo|möchten sie noch etwas/i.test(
    message
  );
}

function isDrinksOnly(draft: AiOrderDraft): boolean {
  return (
    draft.items.length > 0 &&
    draft.items.every((item) => item.menuSection === "drinks")
  );
}

function recapDeclinedMessage(lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return "Alles klar — was darf ich noch hinzufügen?";
    case "en":
      return "Sure — what else would you like to add?";
    case "hr":
      return "U redu — što još želite dodati?";
    case "sr":
      return "U redu — šta još želite da dodam?";
    default:
      return "U redu — šta još želite da dodam?";
  }
}

function abandonOrderMessage(lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return "Kein Problem — ich habe die Bestellung verworfen. Sagen Sie Bescheid, wenn Sie etwas möchten.";
    case "en":
      return "No problem — I've cleared your order. Just let me know if you'd like anything.";
    case "hr":
      return "Nema problema — poništio sam narudžbu. Javite se ako vam zatreba nešto.";
    case "sr":
      return "Nema problema — poništio sam porudžbinu. Javite se ako vam zatreba nešto.";
    default:
      return "Nema problema — poništio sam porudžbinu. Javite se ako vam zatreba nešto.";
  }
}

function sendOrderMessage(lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return "Perfekt — ich sende Ihre Bestellung!";
    case "en":
      return "Great — sending your order!";
    case "hr":
      return "Odlično — šaljem narudžbu!";
    case "sr":
      return "Odlično — šaljem porudžbinu!";
    default:
      return "Odlično — šaljem porudžbinu!";
  }
}

function addedDrinkAskFoodMessage(summary: string, lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return `Alles klar — ${summary}. Möchten Sie noch etwas zu essen?`;
    case "en":
      return `Got it — ${summary}. Would you like something to eat?`;
    case "hr":
      return `U redu — ${summary}. Želite li nešto za jelo?`;
    default:
      return `U redu — ${summary}. Želite li nešto za jelo?`;
  }
}

function resolveMenuLanguage(language: string | undefined): MenuLanguage {
  if (language === "de" || language === "en" || language === "hr") {
    return language;
  }
  if (language === "sr") return "sr";
  return "de";
}

export function emptyCartSubmitBlockedMessage(lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return "In der Bestellung sind noch keine Artikel. Sagen Sie mir, was Sie möchten, und bestätigen Sie danach mit „ja“.";
    case "en":
      return "Your order has no items yet. Tell me what you'd like, then confirm with yes.";
    case "hr":
      return "Narudžba je još prazna. Recite što želite, pa potvrdite s „da“.";
    case "sr":
      return "Porudžbina je još prazna. Recite šta želite, pa potvrdite sa „da“.";
    default:
      return "Porudžbina je još prazna. Recite šta želite, pa potvrdite sa „da“.";
  }
}

export type OrderFlowResult = {
  draft: AiOrderDraft;
  message: string;
  submitOrder: boolean;
  intent: AiConciergeIntent;
};

/**
 * Deterministic guardrails: finish the order in a short path — no endless questions.
 */
export function finalizeOrderFlow(input: {
  userMessage: string;
  draft: AiOrderDraft;
  llmMessage: string;
  llmSubmitOrder: boolean;
  cartActionsThisTurn: number;
  language?: string;
}): OrderFlowResult {
  const lang = resolveMenuLanguage(input.language);
  const draft: AiOrderDraft = {
    ...input.draft,
    flow: { ...input.draft.flow },
  };
  const flow = draft.flow!;
  const hasCartLines = draft.items.length > 0;
  const summary = summarizeDraftOrder(draft);

  if (!hasCartLines && !draft.pending) {
    return {
      draft,
      message: input.llmMessage,
      submitOrder: false,
      intent: input.llmSubmitOrder ? "confirm" : "chat",
    };
  }

  if (input.cartActionsThisTurn > 0 && hasCartLines) {
    flow.foodUpsellAsked = true;

    if (
      isDrinksOnly(draft) &&
      !flow.awaitingFinalConfirm &&
      !isGuestDoneOrdering(input.userMessage) &&
      !isGuestFinalConfirm(input.userMessage)
    ) {
      return {
        draft,
        message: addedDrinkAskFoodMessage(summary, lang),
        submitOrder: false,
        intent: "order",
      };
    }

    flow.awaitingFinalConfirm = true;

    if (
      !draft.pending &&
      (isGuestDoneOrdering(input.userMessage) ||
        isGuestFinalConfirm(input.userMessage))
    ) {
      return {
        draft,
        message: sendOrderMessage(lang),
        submitOrder: true,
        intent: "confirm",
      };
    }

    return {
      draft,
      message: confirmOrderMessage(draft, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (
    !flow.awaitingFinalConfirm &&
    hasCartLines &&
    (isGuestDecliningMore(input.userMessage) ||
      isGuestDoneOrdering(input.userMessage))
  ) {
    flow.foodUpsellAsked = true;
    flow.awaitingFinalConfirm = true;
    return {
      draft,
      message: confirmOrderMessage(draft, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (flow.awaitingFinalConfirm) {
    if (isGuestAbandoningOrder(input.userMessage)) {
      return {
        draft: emptyOrderDraft(),
        message: abandonOrderMessage(lang),
        submitOrder: false,
        intent: "chat",
      };
    }

    const declining = isGuestDecliningMore(input.userMessage);
    const comprehendSubmit = input.llmSubmitOrder && !declining;
    const fastPathSubmit =
      !input.llmSubmitOrder &&
      !declining &&
      !draft.pending &&
      (isGuestFinalConfirm(input.userMessage) ||
        isGuestDoneOrdering(input.userMessage));

    if ((comprehendSubmit || fastPathSubmit) && !draft.pending) {
      return {
        draft,
        message: sendOrderMessage(lang),
        submitOrder: true,
        intent: "confirm",
      };
    }

    if (declining) {
      flow.awaitingFinalConfirm = false;
      return {
        draft,
        message: recapDeclinedMessage(lang),
        submitOrder: false,
        intent: "chat",
      };
    }

    return {
      draft,
      message: confirmOrderMessage(draft, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (flow.foodUpsellAsked && asksAboutFood(input.llmMessage)) {
    flow.awaitingFinalConfirm = true;
    return {
      draft,
      message: confirmOrderMessage(draft, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (asksAboutFood(input.llmMessage)) {
    flow.foodUpsellAsked = true;
  }

  return {
    draft,
    message: input.llmMessage,
    submitOrder: input.llmSubmitOrder,
    intent: input.llmSubmitOrder ? "confirm" : "chat",
  };
}

const FALSE_ORDER_CLAIM_PATTERN =
  /(poru[čc]ujem|naru[čc]ujem|poru[čc]io si|naru[čc]io si|šaljem|saljem|poslat[aoe]?|poslao|poslala|gesendet|unterwegs|send(ing)? (your )?order|bestell(e|ung)? (ist )?(unterwegs|gesendet)|ordering (for you|now)|order (is )?(placed|sent|on its way)|uživaj.*piv)/i;

const FAKE_ASYNC_CHECK_PATTERN =
  /\b(proveri[ćc]u|proveravam|javiti [ćc]e[mt]|javljam.*[ćc]im|check with (the )?(kitchen|staff)|I'll (check|look into)|schaue nach|melde mich)\b/i;

function honestNoOrderStatusMessage(lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return "Es ist noch keine Bestellung für deinen Tisch raus. Sag mir, was du möchtest — ich sende sie, sobald du bestätigst.";
    case "en":
      return "I haven't sent an order for your table yet. Tell me what you'd like — I'll send it once you confirm.";
    case "hr":
      return "Još nemam poslanu narudžbu za tvoj stol. Reci što želiš — mogu odmah poslati kad potvrdiš.";
    case "sr":
      return "Još nisam poslao porudžbinu u kuhinju. Reci šta želiš — pošaljem čim potvrdiš.";
    default:
      return "Još nisam poslao porudžbinu u kuhinju. Reci šta želiš — pošaljem čim potvrdiš.";
  }
}

function honestCartNotSubmittedMessage(
  lang: MenuLanguage,
  draft: AiOrderDraft
): string {
  const recap = formatOrderRecapLines(draft).join(", ");
  switch (lang) {
    case "de":
      return `Aktuell: ${recap}. Noch nicht in der Küche — sag Bescheid, wenn ich senden soll.`;
    case "en":
      return `So far: ${recap}. Not sent to the kitchen yet — tell me when to fire it.`;
    case "hr":
      return `Za sada: ${recap}. Još nije u kuhinji — reci kad da pošaljem.`;
    case "sr":
      return `Za sada: ${recap}. Još nisam poslao u kuhinju — reci da li je to sve ili šta da promenim.`;
    default:
      return `Za sada: ${recap}. Još nisam poslao u kuhinju — reci da li je to sve ili šta da promenim.`;
  }
}

/** Block LLM narration that claims an order was sent when submit did not happen. */
export function sanitizeFalseOrderClaimMessage(input: {
  message: string;
  draft: AiOrderDraft;
  submitOrder: boolean;
  language?: string;
}): string {
  if (input.submitOrder || !FALSE_ORDER_CLAIM_PATTERN.test(input.message)) {
    return input.message;
  }

  const lang = resolveMenuLanguage(input.language);
  const hasCartLines = input.draft.items.length > 0;

  if (!hasCartLines) {
    return honestNoOrderStatusMessage(lang);
  }

  if (input.draft.pending) {
    return confirmOrderMessage(input.draft, lang);
  }

  return honestCartNotSubmittedMessage(lang, input.draft);
}

/** Final guest reply guard — blocks false submit claims and fake async promises. */
export function sanitizeGuestOrderHonesty(input: {
  message: string;
  language?: string;
  orderSubmitted: boolean;
  draft: AiOrderDraft;
}): string {
  if (input.orderSubmitted) return input.message;

  let message = sanitizeFalseOrderClaimMessage({
    message: input.message,
    draft: input.draft,
    submitOrder: false,
    language: input.language,
  });

  if (
    message === input.message &&
    FAKE_ASYNC_CHECK_PATTERN.test(input.message)
  ) {
    message = honestNoOrderStatusMessage(resolveMenuLanguage(input.language));
  }

  return message;
}

export function formatFlowForPrompt(draft: AiOrderDraft): string | null {
  const flow = draft.flow;
  if (!flow) return null;

  const parts: string[] = [];
  if (flow.foodUpsellAsked) {
    parts.push("food_upsell_already_asked=true — do NOT ask about food again");
  }
  if (flow.awaitingFinalConfirm) {
    parts.push(
      "awaiting_final_confirm=true — guest responds to order recap. Comprehend intent in ANY language: natural affirmatives → submitOrder true; add/change items → proposedItems; questions → clarify. Do NOT require words like confirm/potvrdi."
    );
  }
  if (parts.length === 0) return null;
  return `ORDER FLOW STATE:\n- ${parts.join("\n- ")}`;
}
