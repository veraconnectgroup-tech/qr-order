import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";

export type TableGuestCommand =
  | { type: "WAITER.REQUEST" }
  | { type: "BILL.REQUEST" }
  | { type: "BILL.SET_METHOD"; method: SelectablePaymentMethod };

function normalize(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Parse payment method from short guest reply or chip label. */
export function parseHandoffPaymentMethod(
  message: string
): SelectablePaymentMethod | null {
  const text = normalize(message);

  if (
    /^(kes|ke[sš]|gotovina|cash|bar|na kasi|am tisch bar|pay cash)$/.test(
      text
    ) ||
    /\b(gotovin|barzahl|cash)\b/.test(text)
  ) {
    return "at_bar";
  }

  if (
    /^(kartica|karticom|card|karte|terminal|card at table|karte am tisch)$/.test(
      text
    ) ||
    /\b(kartica|karticom|terminal)\b/.test(text)
  ) {
    return "card_at_table";
  }

  if (
    /^(online|karticom online|pay online|apple pay|google pay|stripe)$/.test(
      text
    ) ||
    /\bonline\b/.test(text)
  ) {
    return "online";
  }

  return null;
}

const HANDOFF_WAITER_WORD =
  /\b(waiter|weiter|witer|watr|server|kellner|konobar|garson|serveur|camariere)\b/;

const HANDOFF_WAITER_CALL_VERB =
  /\b(call|bring|need|want|get|ruf|pozov|please|help|come|can you|could you|would you|may i)\b/;

export function isHandoffWaiterMessage(message: string): boolean {
  const text = normalize(message);
  if (
    /pozov[a-zšđčćž]*\s+konobara/.test(text) ||
    /pozov[a-zšđčćž]*\s+mi\s+konobara/.test(text) ||
    /treba\s+(mi\s+)?konobar/.test(text) ||
    /(dodji|dođi|dođite)\s+konobar/.test(text) ||
    /(ruf(en)?\s+(den\s+)?kellner|kellner\s+(holen|rufen))/.test(text) ||
    /(call\s+(the\s+)?waiter|need\s+a\s+waiter|waiter\s+please)/.test(text) ||
    text === "konobar"
  ) {
    return true;
  }

  // Typos + free phrasing: "call a weiter please", "can you get a server"
  if (HANDOFF_WAITER_WORD.test(text) && HANDOFF_WAITER_CALL_VERB.test(text)) {
    return true;
  }

  return false;
}

export function isHandoffBillRequestMessage(message: string): boolean {
  const text = normalize(message);
  if (parseHandoffPaymentMethod(message)) return false;
  return (
    /\b(račun|racun|rechnung|bill|checkout)\b/.test(text) ||
    /(želim|zelim|hoću|hocu|treba)\s+(da\s+)?(platim|platiti|naplatim|naplatiti)/.test(
      text
    ) ||
    /\b(zaplat(i|iti|imo)|plat(i|iti|imo))\b/.test(text) ||
    /\b(po[sš]alji(te)?\s+(mi\s+)?(račun|racun|rechnung|bill))\b/.test(text) ||
    /\b(donesi(te)?\s+(mi\s+)?(račun|racun|rechnung|bill))\b/.test(text) ||
    /\b(bring\s+(the\s+)?bill|check\s+please|pay\s+please|want\s+to\s+pay)\b/.test(
      text
    ) ||
    /\b(kann\s+ich\s+zahlen|rechnung\s+bitte|bezahlen)\b/.test(text)
  );
}

export function mapStructuredIntentToCommand(
  intent: GuestIntent,
  paymentMethod?: SelectablePaymentMethod | null
): TableGuestCommand | null {
  if (intent === "HANDOFF_WAITER") {
    return { type: "WAITER.REQUEST" };
  }
  if (intent === "HANDOFF_PAY") {
    if (paymentMethod) {
      return { type: "BILL.SET_METHOD", method: paymentMethod };
    }
    return { type: "BILL.REQUEST" };
  }
  return null;
}

/** Map free text or structured intent to table guest command (T0). */
export function perceiveTableGuestCommand(input: {
  message: string;
  structuredIntent?: GuestIntent | null;
  paymentMethod?: SelectablePaymentMethod | null;
  customPhrases?: string[];
}): {
  command: TableGuestCommand;
  intent: GuestIntent;
  paymentMethod: SelectablePaymentMethod | null;
} | null {
  if (input.structuredIntent === "HANDOFF_WAITER") {
    return {
      command: { type: "WAITER.REQUEST" },
      intent: "HANDOFF_WAITER",
      paymentMethod: null,
    };
  }

  if (input.structuredIntent === "HANDOFF_PAY") {
    const method = input.paymentMethod ?? null;
    return {
      command: method
        ? { type: "BILL.SET_METHOD", method }
        : { type: "BILL.REQUEST" },
      intent: "HANDOFF_PAY",
      paymentMethod: method,
    };
  }

  for (const phrase of input.customPhrases ?? []) {
    const normalized = normalize(phrase);
    if (!normalized) continue;
    if (normalize(input.message).includes(normalized)) {
      if (/waiter|konobar|kellner/.test(normalized)) {
        return {
          command: { type: "WAITER.REQUEST" },
          intent: "HANDOFF_WAITER",
          paymentMethod: null,
        };
      }
    }
  }

  if (isHandoffWaiterMessage(input.message)) {
    return {
      command: { type: "WAITER.REQUEST" },
      intent: "HANDOFF_WAITER",
      paymentMethod: null,
    };
  }

  const method = parseHandoffPaymentMethod(input.message);
  if (method) {
    return {
      command: { type: "BILL.SET_METHOD", method },
      intent: "HANDOFF_PAY",
      paymentMethod: method,
    };
  }

  if (isHandoffBillRequestMessage(input.message)) {
    return {
      command: { type: "BILL.REQUEST" },
      intent: "HANDOFF_PAY",
      paymentMethod: null,
    };
  }

  return null;
}

export function chipIdToHandoff(input: {
  chipId: string;
  label: string;
}): {
  structuredIntent?: GuestIntent;
  paymentMethod?: SelectablePaymentMethod;
} | null {
  if (input.chipId === "situation-waiter") {
    return { structuredIntent: "HANDOFF_WAITER" };
  }
  if (
    input.chipId === "pay-cash" ||
    input.chipId === "chip-kes" ||
    /^pay-cash$/i.test(input.chipId)
  ) {
    return { structuredIntent: "HANDOFF_PAY", paymentMethod: "at_bar" };
  }
  if (
    input.chipId === "pay-card" ||
    input.chipId === "chip-kartica" ||
    /^pay-card$/i.test(input.chipId)
  ) {
    return { structuredIntent: "HANDOFF_PAY", paymentMethod: "card_at_table" };
  }
  if (
    input.chipId === "pay-online" ||
    input.chipId === "chip-online" ||
    /^pay-online$/i.test(input.chipId)
  ) {
    return { structuredIntent: "HANDOFF_PAY", paymentMethod: "online" };
  }

  const method = parseHandoffPaymentMethod(input.label);
  if (method) {
    return { structuredIntent: "HANDOFF_PAY", paymentMethod: method };
  }

  return null;
}
