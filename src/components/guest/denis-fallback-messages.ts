export type SupportedFallbackLanguage =
  | "de"
  | "en"
  | "sr"
  | "hr"
  | "fr"
  | "it"
  | "es"
  | "nl"
  | "pl"
  | "tr";

export type DenisFallbackLevel = 1 | 2 | 3 | 4;

export type FallbackMessages = {
  thinking: string;
  thinkingSlow: string;
  busy: string;
  resting: string;
  callWaiter: string;
  orderStandard: string;
  browseMenu: string;
};

export const FALLBACK_MESSAGES: Record<SupportedFallbackLanguage, FallbackMessages> = {
  de: {
    thinking: "Denis denkt nach...",
    thinkingSlow: "Danke für deine Geduld — Denis antwortet gleich.",
    busy: "Denis ist gerade beschäftigt. Ich kann dir helfen:",
    resting: "Denis macht eine kurze Pause 😴",
    callWaiter: "Kellner rufen",
    orderStandard: "Normal bestellen",
    browseMenu: "Menü durchstöbern",
  },
  en: {
    thinking: "Denis is thinking...",
    thinkingSlow: "Thanks for waiting — Denis is on it.",
    busy: "Denis is a bit busy right now. I can help you:",
    resting: "Denis is resting 😴",
    callWaiter: "Call waiter",
    orderStandard: "Order normally",
    browseMenu: "Browse menu",
  },
  sr: {
    thinking: "Denis razmišlja...",
    thinkingSlow: "Hvala na strpljenju, Denis odgovara uskoro.",
    busy: "Denis je malo zauzet. Mogu ti pomoći:",
    resting: "Denis se odmara 😴",
    callWaiter: "Pozovi konobara",
    orderStandard: "Naruči standardno",
    browseMenu: "Pregledaj meni",
  },
  hr: {
    thinking: "Denis razmišlja...",
    thinkingSlow: "Hvala na strpljenju, Denis odgovara uskoro.",
    busy: "Denis je malo zauzet. Mogu ti pomoći:",
    resting: "Denis se odmara 😴",
    callWaiter: "Pozovi konobara",
    orderStandard: "Naruči standardno",
    browseMenu: "Pregledaj jelovnik",
  },
  fr: {
    thinking: "Denis réfléchit...",
    thinkingSlow: "Merci de patienter — Denis répond bientôt.",
    busy: "Denis est un peu occupé. Je peux vous aider :",
    resting: "Denis se repose 😴",
    callWaiter: "Appeler le serveur",
    orderStandard: "Commander normalement",
    browseMenu: "Parcourir le menu",
  },
  it: {
    thinking: "Denis sta pensando...",
    thinkingSlow: "Grazie per l'attesa — Denis risponde tra poco.",
    busy: "Denis è un po' occupato. Posso aiutarti:",
    resting: "Denis si riposa 😴",
    callWaiter: "Chiama il cameriere",
    orderStandard: "Ordina normalmente",
    browseMenu: "Sfoglia il menu",
  },
  es: {
    thinking: "Denis está pensando...",
    thinkingSlow: "Gracias por esperar — Denis responderá pronto.",
    busy: "Denis está un poco ocupado. Puedo ayudarte:",
    resting: "Denis descansa 😴",
    callWaiter: "Llamar al camarero",
    orderStandard: "Pedir normalmente",
    browseMenu: "Ver el menú",
  },
  nl: {
    thinking: "Denis denkt na...",
    thinkingSlow: "Bedankt voor je geduld — Denis antwoordt zo.",
    busy: "Denis is even druk. Ik kan je helpen:",
    resting: "Denis rust even 😴",
    callWaiter: "Ober roepen",
    orderStandard: "Normaal bestellen",
    browseMenu: "Menu bekijken",
  },
  pl: {
    thinking: "Denis myśli...",
    thinkingSlow: "Dzięki za cierpliwość — Denis zaraz odpowie.",
    busy: "Denis jest teraz zajęty. Mogę pomóc:",
    resting: "Denis odpoczywa 😴",
    callWaiter: "Wezwij kelnera",
    orderStandard: "Zamów normalnie",
    browseMenu: "Przeglądaj menu",
  },
  tr: {
    thinking: "Denis düşünüyor...",
    thinkingSlow: "Sabırınız için teşekkürler — Denis yakında yanıtlayacak.",
    busy: "Denis şu an meşgul. Size yardımcı olabilirim:",
    resting: "Denis dinleniyor 😴",
    callWaiter: "Garson çağır",
    orderStandard: "Normal sipariş ver",
    browseMenu: "Menüye göz at",
  },
};

export function resolveFallbackLocale(
  locale: string | null | undefined
): SupportedFallbackLanguage {
  const key = (locale ?? "en").slice(0, 2).toLowerCase();
  if (key in FALLBACK_MESSAGES) {
    return key as SupportedFallbackLanguage;
  }
  return "en";
}

export function resolveDenisFallbackLevel(input: {
  circuitOpen?: boolean;
  circuitHalfOpen?: boolean;
  infrastructureDown?: boolean;
  slowMs?: number;
}): DenisFallbackLevel {
  if (input.infrastructureDown) return 4;
  if (input.circuitOpen) return 3;
  if (input.circuitHalfOpen) return 2;
  if ((input.slowMs ?? 0) >= 5000) return 1;
  return 1;
}

export function fallbackMessageForLevel(
  level: DenisFallbackLevel,
  locale: string | null | undefined,
  slow = false
): string {
  const messages = FALLBACK_MESSAGES[resolveFallbackLocale(locale)];
  if (level >= 3) return messages.resting;
  if (level >= 2) return messages.busy;
  return slow ? messages.thinkingSlow : messages.thinking;
}
