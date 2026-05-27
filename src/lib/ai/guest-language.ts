import {
  detectGuestMessageLanguage,
  resolveAiPromptLanguage,
  type AI_SUPPORTED_LANGUAGES,
} from "@/lib/ai/config";
import {
  t,
  translations,
  type Locale,
  type MenuLocale,
  type TranslationKey,
} from "@/lib/i18n/translations";

function applyTranslationVars(
  text: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return text;
  let out = text;
  for (const [name, value] of Object.entries(vars)) {
    const s = String(value);
    out = out.replaceAll(`{${name}}`, s);
    out = out.replaceAll(`#{${name}}`, s);
  }
  return out;
}

function lookupTranslation(
  key: TranslationKey,
  locale: Locale
): string {
  const table = translations[locale] ?? translations.de;
  return (
    table[key] ??
    translations.en[key] ??
    translations.de[key] ??
    key
  );
}

type AiLang = (typeof AI_SUPPORTED_LANGUAGES)[number];

/** Short confirms / thanks — keep session language (avoid "yes please" → en flip). */
export function isLanguageNeutralGuestMessage(message: string): boolean {
  const text = message.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text || text.length > 48) return false;

  return (
    /^(da|ja|yes|yep|yeah|ok|okay|okej|potvrdi|pošalji|posalji|send|confirm|bestätigen|bestellen|naruči|naruci)([\s,.!]|$)/.test(
      text
    ) ||
    /^(da|ja),?\s*(pošalji|posalji|potvrdi|molim|hvala|please|thanks?)/.test(text) ||
    /^(yes|ok|okay),?\s*please([\s,.!]|$)/.test(text) ||
    /^(molim|hvala|thanks?|thank you|bitte|danke)([\s,.!]|$)/.test(text) ||
    /^(ne hvala|ne,?\s*hvala|nein danke)([\s,.!]|$)/.test(text)
  );
}

/**
 * Language for assistant replies this turn — prefers detected guest language,
 * keeps session on neutral confirms (M27 language stickiness).
 */
export function resolveStickyGuestLanguage(
  guestMessage: string,
  menuLanguageInput: string,
  sessionLanguage?: string | null
): AiLang {
  const venue = resolveAiPromptLanguage(menuLanguageInput);
  const session = sessionLanguage
    ? resolveAiPromptLanguage(sessionLanguage)
    : null;

  if (isLanguageNeutralGuestMessage(guestMessage) && session) {
    return session;
  }

  const detection = detectGuestMessageLanguage(guestMessage, menuLanguageInput);
  if (detection.confidence === "high" && detection.detected !== "unknown") {
    return detection.detected;
  }

  return session ?? venue;
}

/** UI strings for order submit / status using conversation language, not menu splash. */
export function tForAiGuestLanguage(
  key: TranslationKey,
  aiLang: string,
  vars?: Record<string, string | number>
): string {
  const normalized = aiLang.trim().toLowerCase().slice(0, 2);
  if (normalized === "en") {
    return applyTranslationVars(lookupTranslation(key, "en"), vars);
  }
  if (normalized === "sr") {
    return applyTranslationVars(lookupTranslation(key, "sr"), vars);
  }
  if (
    (
      ["de", "sr", "hr", "tr", "ar", "fr", "es", "it", "ru"] as const
    ).includes(normalized as MenuLocale)
  ) {
    return applyTranslationVars(
      lookupTranslation(key, normalized as Locale),
      vars
    );
  }
  return applyTranslationVars(lookupTranslation(key, "de"), vars);
}
