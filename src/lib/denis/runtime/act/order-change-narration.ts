export type OrderChangeNarrationKey =
  | "cancel_ok"
  | "modify_cancelled_reorder"
  | "staff_escalation_cancel"
  | "staff_escalation_modify"
  | "no_open_order"
  | "cancel_failed"
  | "handoff_failed";

const MESSAGES: Record<OrderChangeNarrationKey, Record<string, string>> = {
  cancel_ok: {
    sr: "U redu — porudžbina #{number} je otkazana.",
    de: "Alles klar — Bestellung #{number} wurde storniert.",
    en: "Done — order #{number} is cancelled.",
  },
  modify_cancelled_reorder: {
    sr: "Otkazao sam #{number} — reci šta želiš umesto toga.",
    de: "Ich habe #{number} storniert — sag mir, was du stattdessen möchtest.",
    en: "I cancelled #{number} — tell me what you'd like instead.",
  },
  staff_escalation_cancel: {
    sr: "Porudžbina #{number} je već u kuhinji — zvao sam konobara da pomogne.",
    de: "Bestellung #{number} ist schon in der Küche — ich habe Service gerufen.",
    en: "Order #{number} is already in the kitchen — I've called staff to help.",
  },
  staff_escalation_modify: {
    sr: "Ne mogu sam da promenim #{number} — konobar stiže da pomogne.",
    de: "Ich kann #{number} nicht selbst ändern — Service kommt gleich.",
    en: "I can't change #{number} myself — staff is on the way.",
  },
  no_open_order: {
    sr: "Nema aktivne porudžbine za otkazivanje.",
    de: "Keine offene Bestellung zum Stornieren.",
    en: "No open order to cancel.",
  },
  cancel_failed: {
    sr: "Trenutno ne mogu da otkažem — pitaj konobara.",
    de: "Stornierung gerade nicht möglich — bitte Service fragen.",
    en: "Can't cancel right now — please ask staff.",
  },
  handoff_failed: {
    sr: "Trenutno ne mogu — pitaj osoblje.",
    de: "Das geht gerade nicht — bitte das Team fragen.",
    en: "Can't do that right now — please ask staff.",
  },
};

export function orderChangeNarrationMessage(
  key: OrderChangeNarrationKey,
  language: string,
  orderNumber?: number | null
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const template =
    MESSAGES[key][lang] ?? MESSAGES[key].sr ?? MESSAGES[key].en;
  const formatted =
    orderNumber != null ? `#${orderNumber}` : "—";
  return template.replace("#{number}", formatted);
}

export function orderChangeErrorNarrationKey(
  error: string
): OrderChangeNarrationKey {
  if (error === "no_open_order") return "no_open_order";
  if (error === "cancel_failed") return "cancel_failed";
  return "handoff_failed";
}
