/** Guest-visible Denis copy — head-waiter tone, never shopping-cart UI. */

export type GuestChatLanguage = "de" | "en" | "sr";

export function normalizeGuestChatLanguage(language: string): GuestChatLanguage {
  const lang = language.trim().toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

/** Short acknowledgment when Denis takes an order line — like a waiter, not a POS. */
export function waiterAckMessage(language: string, itemsSummary: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return `Alles klar — ${itemsSummary}.`;
    case "en":
      return `Got it — ${itemsSummary}.`;
    default:
      return `Razumem — ${itemsSummary}.`;
  }
}

/** @deprecated Prefer waiterAckMessage — alias for call sites. */
export const cartAddedMessage = waiterAckMessage;

export function cartSummaryMessage(language: string, summary: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return `Aktuell: ${summary}.`;
    case "en":
      return `So far: ${summary}.`;
    default:
      return `Za sada: ${summary}.`;
  }
}

export function pairingSuggestionMessage(
  language: string,
  name: string,
  price: string
): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return `Dazu passt gut ${name} (${price}) — soll ich's dazunehmen?`;
    case "en":
      return `${name} (${price}) pairs nicely — want me to add it?`;
    default:
      return `Dobro bi išlo uz to ${name} (${price}) — da dodam?`;
  }
}

export function orderSentTemplateMessage(
  language: string,
  orderNumber: number
): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return `Perfekt — #${orderNumber} geht in die Küche.`;
    case "en":
      return `Perfect — #${orderNumber} is heading to the kitchen.`;
    default:
      return `Odlično — #${orderNumber} ide u kuhinju.`;
  }
}

export function reconcileCartMessage(language: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return "Chat und Bestellung passen nicht zusammen — soll ich das angleichen?";
    case "en":
      return "Your order notes don't quite match — want me to sort that out?";
    default:
      return "Ne slažemo se oko porudžbine — da sredim?";
  }
}

/**
 * Deep last-resort fallback for HANDOFF goal (reached only when the handoff
 * ACT hasn't produced a specific guestMessage yet — see
 * resolve-act-handoff-outcome.ts, which normally supplies a situation-specific
 * committed.handoffMessage instead). `kind` narrows wording when known; the
 * "waiter"/undefined case keeps the exact original string (safety net).
 */
export function handoffWaitMessage(
  language: string,
  kind?: "waiter" | "payment"
): string {
  if (kind === "payment") {
    switch (normalizeGuestChatLanguage(language)) {
      case "de":
        return "Ich kümmere mich um die Zahlung — einen Moment.";
      case "en":
        return "Getting your payment sorted — just a moment.";
      default:
        return "Sređujem plaćanje — samo trenutak.";
    }
  }
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return "Bin gleich bei Ihnen — einen Moment.";
    case "en":
      return "On my way — just a moment.";
    default:
      return "Na putu sam — samo trenutak.";
  }
}

export function clarifyPaymentMessage(language: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return "Wie zahlen Sie — bar, Karte am Tisch oder online?";
    case "en":
      return "How would you like to pay — cash, card at the table, or online?";
    default:
      return "Kako plaćate — kes, kartica na stolu, ili online?";
  }
}

export function clarifySizeMessage(language: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return "Welche Größe darf's sein?";
    case "en":
      return "What size would you like?";
    default:
      return "Koja veličina vam odgovara?";
  }
}

export function clarifyModifierMessage(language: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return "Wie hätten Sie's gern zubereitet?";
    case "en":
      return "How would you like that prepared?";
    default:
      return "Kako da to pripremimo?";
  }
}

export function clarifyProductMessage(language: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return "Welches möchten Sie genau?";
    case "en":
      return "Which one would you like exactly?";
    default:
      return "Koje tačno želite?";
  }
}

/**
 * Slot-aware clarify fallback (CLARIFY_SLOT goal, last resort only — the
 * narrator normally phrases this from committed.pendingSlotKind). Routes to
 * the wording that matches what's actually pending instead of always asking
 * about payment.
 */
export function clarifySlotMessage(
  language: string,
  slotKind?: "serve_size" | "modifier" | "product" | "payment_method" | string
): string {
  switch (slotKind) {
    case "serve_size":
      return clarifySizeMessage(language);
    case "modifier":
      return clarifyModifierMessage(language);
    case "product":
      return clarifyProductMessage(language);
    default:
      return clarifyPaymentMessage(language);
  }
}

export function denisIntroMessage(language: string, personaName: string): string {
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return `Ich bin ${personaName} — sag mir, womit ich anfangen darf.`;
    case "en":
      return `I'm ${personaName} — what can I get started for you?`;
    default:
      return `Ja sam ${personaName} — reci od čega krećemo.`;
  }
}

export function productUnavailableMessage(
  language: string,
  productNames: string[]
): string {
  const list = productNames.join(", ");
  switch (normalizeGuestChatLanguage(language)) {
    case "de":
      return `${list} ist gerade nicht verfügbar.`;
    case "en":
      return `${list} isn't available right now.`;
    default:
      return `${list} trenutno nije dostupno.`;
  }
}
