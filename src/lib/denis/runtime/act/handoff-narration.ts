import type { SelectablePaymentMethod } from "@/lib/payment-methods";

export type HandoffNarrationKey =
  | "waiter_on_way"
  | "ask_payment_method"
  | "payment_cash"
  | "payment_card"
  | "payment_online"
  | "nothing_to_pay"
  | "payment_already_requested"
  | "no_session"
  | "method_unavailable"
  | "session_closing"
  | "split_bill_active"
  | "handoff_failed";

const MESSAGES: Record<
  HandoffNarrationKey,
  Record<string, string>
> = {
  waiter_on_way: {
    sr: "Na putu sam — samo trenutak.",
    de: "Ich komme gleich — einen Moment.",
    en: "On my way — just a moment.",
  },
  ask_payment_method: {
    sr: "Naravno. Kako plaćate — kes, kartica na stolu, ili online?",
    de: "Gerne. Wie möchten Sie zahlen — bar, Karte am Tisch oder online?",
    en: "Of course. How would you like to pay — cash, card at the table, or online?",
  },
  payment_cash: {
    sr: "U redu — dolazim sa računom.",
    de: "Alles klar — ich komme mit der Rechnung.",
    en: "Got it — I'll bring the bill.",
  },
  payment_card: {
    sr: "Stižem sa terminalom.",
    de: "Ich komme mit dem Terminal.",
    en: "I'll bring the card terminal.",
  },
  payment_online: {
    sr: "Evo — otvaram plaćanje karticom.",
    de: "Ich öffne die Online-Zahlung.",
    en: "Opening card payment for you.",
  },
  nothing_to_pay: {
    sr: "Još nema računa — prvo naručite, pa javite.",
    de: "Noch keine Rechnung — bestellen Sie zuerst.",
    en: "No bill yet — order first, then ask again.",
  },
  payment_already_requested: {
    sr: "Račun je već zatražen — stižem uskoro.",
    de: "Die Rechnung wurde schon angefordert — ich komme gleich.",
    en: "Bill already requested — on my way.",
  },
  no_session: {
    sr: "Sesija nije aktivna — osvežite QR kod.",
    de: "Sitzung nicht aktiv — QR-Code neu scannen.",
    en: "Session not active — refresh the QR code.",
  },
  method_unavailable: {
    sr: "Taj način plaćanja nije dostupan ovde.",
    de: "Diese Zahlungsart ist hier nicht verfügbar.",
    en: "That payment method isn't available here.",
  },
  session_closing: {
    sr: "Sto se zatvara — plaćanje trenutno nije moguće.",
    de: "Tisch wird geschlossen — Zahlung gerade nicht möglich.",
    en: "Table is closing — payment isn't available right now.",
  },
  split_bill_active: {
    sr: "Račun se deli — platite svoj deo na split ekranu.",
    de: "Rechnung wird geteilt — bitte auf dem Split-Bildschirm zahlen.",
    en: "Bill is being split — pay your share on the split screen.",
  },
  handoff_failed: {
    sr: "Trenutno ne mogu — pitajte osoblje.",
    de: "Das geht gerade nicht — bitte das Team fragen.",
    en: "Can't do that right now — please ask staff.",
  },
};

export function handoffNarrationMessage(
  key: HandoffNarrationKey,
  language: string
): string {
  const lang = language.toLowerCase().slice(0, 2);
  return MESSAGES[key][lang] ?? MESSAGES[key].sr ?? MESSAGES[key].en;
}

export function paymentMethodNarrationKey(
  method: SelectablePaymentMethod
): HandoffNarrationKey {
  if (method === "at_bar") return "payment_cash";
  if (method === "card_at_table") return "payment_card";
  return "payment_online";
}

export function handoffErrorNarrationKey(error: string): HandoffNarrationKey {
  switch (error) {
    case "nothing_to_pay":
      return "nothing_to_pay";
    case "payment_already_requested":
      return "payment_already_requested";
    case "no_active_session":
    case "Session expired or invalid":
    case "Session expired or invalid.":
      return "no_session";
    case "method_unavailable":
      return "method_unavailable";
    case "session_closing":
      return "session_closing";
    case "split_bill_active":
      return "split_bill_active";
    case "missing_handoff_context":
    case "table_not_found":
    case "location_mismatch":
      return "no_session";
    default:
      return "handoff_failed";
  }
}

export function paymentMethodQuickReplyLabels(language: string): string[] {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") return ["Bar", "Karte am Tisch", "Online"];
  if (lang === "en") return ["Cash", "Card at table", "Online"];
  return ["Kes", "Kartica", "Online"];
}
