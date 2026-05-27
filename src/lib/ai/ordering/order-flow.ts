import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
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

export function isGuestDecliningMore(message: string): boolean {
  const text = normalizeMessage(message);
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

  if (draft.flow?.awaitingFinalConfirm && isGuestFinalConfirm(message)) {
    return true;
  }

  if (draft.flow?.foodUpsellAsked && isGuestDecliningMore(message)) {
    return true;
  }

  return false;
}

export function isGuestFinalConfirm(message: string): boolean {
  const text = normalizeMessage(message);
  return (
    /^(da|ja|yes|yep|ok+|potvrdi|bestätigen|bestätige|confirm|pošalji|posalji|send|bestellen|naruči|naruci)([\s,.!]|$)/.test(
      text
    ) ||
    /^(da|ja),?\s*(pošalji|posalji|potvrdi|bestätigen|send|naruči|naruci)/.test(
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

function confirmOrderMessage(summary: string, lang: MenuLanguage): string {
  switch (lang) {
    case "de":
      return `Bitte bestätigen Sie: ${summary}. Soll ich die Bestellung senden?`;
    case "en":
      return `Please confirm: ${summary}. Shall I send the order?`;
    case "hr":
      return `Molim potvrdite: ${summary}. Da pošaljem narudžbu?`;
    case "sr":
      return `Molim potvrdite porudžbinu: ${summary}. Da pošaljem?`;
    default:
      return `Molim potvrdite porudžbinu: ${summary}. Da pošaljem?`;
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

/** Guest tried to confirm/submit but session cart has no line items. */
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
  const hasItems = draft.items.length > 0 && !draft.pending;
  const summary = summarizeDraftOrder(draft);

  if (!hasItems) {
    return {
      draft,
      message: input.llmMessage,
      submitOrder: false,
      intent: input.llmSubmitOrder ? "confirm" : "chat",
    };
  }

  if (
    flow.awaitingFinalConfirm &&
    isGuestFinalConfirm(input.userMessage) &&
    !isGuestDecliningMore(input.userMessage)
  ) {
    return {
      draft,
      message: sendOrderMessage(lang),
      submitOrder: true,
      intent: "confirm",
    };
  }

  if (
    isGuestDecliningMore(input.userMessage) ||
    isGuestDoneOrdering(input.userMessage)
  ) {
    flow.foodUpsellAsked = true;
    flow.awaitingFinalConfirm = true;
    return {
      draft,
      message: confirmOrderMessage(summary, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (input.cartActionsThisTurn > 0) {
    flow.foodUpsellAsked = true;

    if (isDrinksOnly(draft) && !flow.awaitingFinalConfirm) {
      return {
        draft,
        message: addedDrinkAskFoodMessage(summary, lang),
        submitOrder: false,
        intent: "order",
      };
    }

    flow.awaitingFinalConfirm = true;
    return {
      draft,
      message: confirmOrderMessage(summary, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (flow.awaitingFinalConfirm) {
    return {
      draft,
      message: confirmOrderMessage(summary, lang),
      submitOrder: false,
      intent: "confirm",
    };
  }

  if (flow.foodUpsellAsked && asksAboutFood(input.llmMessage)) {
    flow.awaitingFinalConfirm = true;
    return {
      draft,
      message: confirmOrderMessage(summary, lang),
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

export function formatFlowForPrompt(draft: AiOrderDraft): string | null {
  const flow = draft.flow;
  if (!flow) return null;

  const parts: string[] = [];
  if (flow.foodUpsellAsked) {
    parts.push("food_upsell_already_asked=true — do NOT ask about food again");
  }
  if (flow.awaitingFinalConfirm) {
    parts.push(
      "awaiting_final_confirm=true — only recap the order or set submitOrder on explicit yes"
    );
  }
  if (parts.length === 0) return null;
  return `ORDER FLOW STATE:\n- ${parts.join("\n- ")}`;
}
