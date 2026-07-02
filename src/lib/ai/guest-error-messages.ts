/** Guest-visible AI error copy — follows guest/venue language (not hardcoded DE). */

import {
  resolveFallbackLocale,
  type SupportedFallbackLanguage,
} from "@/components/guest/denis-fallback-messages";

type AiGuestErrorCopy = {
  retry: string;
  unavailable: string;
};

const AI_GUEST_ERROR_MESSAGES: Record<SupportedFallbackLanguage, AiGuestErrorCopy> =
  {
    de: {
      retry: "Entschuldigung, bitte versuchen Sie es erneut.",
      unavailable:
        "KI-Assistent ist gerade nicht verfügbar. Sie können normal bestellen.",
    },
    en: {
      retry: "Sorry, please try again.",
      unavailable:
        "The AI assistant is temporarily unavailable. You can still order normally.",
    },
    sr: {
      retry: "Izvinite, pokušajte ponovo.",
      unavailable:
        "AI asistent trenutno nije dostupan. Možete normalno naručiti.",
    },
    hr: {
      retry: "Oprostite, pokušajte ponovo.",
      unavailable:
        "AI asistent trenutno nije dostupan. Možete normalno naručiti.",
    },
    fr: {
      retry: "Désolé, veuillez réessayer.",
      unavailable:
        "L'assistant IA est indisponible. Vous pouvez commander normalement.",
    },
    it: {
      retry: "Scusa, riprova per favore.",
      unavailable:
        "L'assistente IA non è disponibile. Puoi ordinare normalmente.",
    },
    es: {
      retry: "Disculpa, inténtalo de nuevo.",
      unavailable:
        "El asistente de IA no está disponible. Puedes pedir con normalidad.",
    },
    nl: {
      retry: "Sorry, probeer het opnieuw.",
      unavailable:
        "De AI-assistent is tijdelijk niet beschikbaar. Je kunt gewoon bestellen.",
    },
    pl: {
      retry: "Przepraszam, spróbuj ponownie.",
      unavailable:
        "Asystent AI jest chwilowo niedostępny. Możesz zamówić normalnie.",
    },
    tr: {
      retry: "Özür dileriz, lütfen tekrar deneyin.",
      unavailable:
        "Yapay zeka asistanı şu an kullanılamıyor. Normal sipariş verebilirsiniz.",
    },
  };

export function resolveAiGuestRetryMessage(
  language: string | null | undefined
): string {
  const locale = resolveFallbackLocale(language);
  return AI_GUEST_ERROR_MESSAGES[locale].retry;
}

export function resolveAiGuestUnavailableMessage(
  language: string | null | undefined
): string {
  const locale = resolveFallbackLocale(language);
  return AI_GUEST_ERROR_MESSAGES[locale].unavailable;
}
