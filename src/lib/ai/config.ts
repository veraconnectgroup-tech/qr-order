/** AI Concierge — centralized configuration */

export const AI_CONFIG = {
  /** Primary chat model */
  model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  /** Fallback when primary fails or is unavailable */
  fallbackModel: process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-4o-mini",
  maxTokens: 800,
  temperature: 0.4,
  /** Credits debited per concierge turn (API layer) */
  creditsPerMessage: 1,
  /** Max curated recommendations (personal picks) */
  maxRecommendations: 3,
  /** Max menu items shown as tappable browse list in chat */
  maxBrowseRecommendations: 12,
  /** OpenAI request timeout */
  requestTimeoutMs: 10_000,
  /** Initial attempt + retries (3 attempts = 2 retries) */
  maxRetryAttempts: 3,
  /** Base delay for exponential backoff (ms): 500ms, 1000ms */
  retryBaseDelayMs: 500,
  /** Guest AI session max duration */
  sessionTimeoutMs: 60 * 60 * 1000,
  /** Max stored messages per AI session (user + assistant) */
  maxMessagesPerSession: 30,
  /** One extra OpenAI call when JSON parse fails */
  parseRetryAttempts: 1,
  fallbackMessage:
    "Entschuldigung, bitte versuchen Sie es erneut.",
  circuitBreakerMessage:
    "KI-Assistent ist gerade nicht verfügbar. Sie können normal bestellen.",
  /** Embedding model for menu RAG (Vercel AI Gateway / OpenAI compatible). */
  embeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  /** Menu cache TTL in Redis */
  menuCacheTtlSeconds: 300,
  menuCacheKeyPrefix: "ai:menu:",
  /** Menu RAG product embedding index TTL in Redis */
  menuRagEmbeddingCacheTtlSeconds: 3600,
  menuRagEmbeddingCacheKeyPrefix: "ai:menu-rag-emb:",
  playbookCacheTtlSeconds: 300,
  playbookCacheKeyPrefix: "ai:playbook:",
  maxPlaybookExamples: 20,
  circuitBreaker: {
    failureThreshold: 5,
    openDurationMs: 30_000,
  },
  input: {
    maxLength: 500,
  },
  rateLimits: {
    perSessionPerMinute: 10,
    perTablePerHour: 30,
    perLocationPerMinute: 60,
  },
} as const;

/**
 * Case-insensitive patterns for prompt-injection / jailbreak attempts.
 * Kept in config so ops can extend via env JSON later if needed.
 */
export const AI_BLOCKED_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /\b(system|developer)\s+prompt\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /reveal\s+(your|the)\s+(system|hidden|secret)\s+(prompt|instructions?)/i,
  /output\s+(the\s+)?(system|initial)\s+prompt/i,
  /<\s*\/?\s*(system|assistant|user)\s*>/i,
  /\bact\s+as\s+if\s+you\s+have\s+no\s+restrictions\b/i,
  /\bbypass\s+(safety|content|moderation)\b/i,
];

export const AI_SUPPORTED_LANGUAGES = [
  "de",
  "en",
  "sr",
  "hr",
  "tr",
  "fr",
  "es",
  "it",
  "ru",
  "ar",
] as const;

const MENU_LANGUAGE_LABELS: Record<string, string> = {
  de: "German",
  en: "English",
  sr: "Serbian",
  hr: "Croatian",
  tr: "Turkish",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
};

export function menuLanguageLabel(language: string): string {
  const code = language.trim().toLowerCase().slice(0, 2);
  return MENU_LANGUAGE_LABELS[code] ?? "English";
}

export function resolveAiPromptLanguage(language: string): (typeof AI_SUPPORTED_LANGUAGES)[number] {
  const normalized = language.trim().toLowerCase().slice(0, 2);
  if ((AI_SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized as (typeof AI_SUPPORTED_LANGUAGES)[number];
  }
  return "en";
}

export type GuestLanguageDetection = {
  detected: (typeof AI_SUPPORTED_LANGUAGES)[number] | "unknown";
  confidence: "high" | "low";
};

const LATIN_BALKAN_PATTERN =
  /\b(jedn[auo]|molim|hvala|naru[čc]|poru[čc]|potvrd|donesi|donij|imam|alergij|pivo|cola|kola|jo[sš]|sve|nema|mo[žz]e|moze|želim|zelim|ho[ćc]u|hocu|imate|zdravo|dobar|gde|gdje|sta|šta|kako|si|ste|sam|smo|brate|bre|legendo|legend|ćao|cao|jel|jesi|nisi|reci|recite|ajde|idem|idemo|super|odlično|odlicno|samo|sad|sada|kasnije|hajde|izvini|izvinite|naravno|važi|vazi|može|moze|mali|velik[oa]?|ra[čc]un|racun|po[sš]alji|posalji|denis[e]?)\b/i;

/** Guest explicitly asks to switch language ("nur auf Serbisch", "na srpskom"). */
const EXPLICIT_LANGUAGE_PREFERENCE: Array<{
  pattern: RegExp;
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number];
}> = [
  {
    pattern:
      /\b(serbisch|serbian|srpski|na srpskom|samo srpski|samo na srpskom|auf serbisch|nur (auf )?serbisch|weiter (nur )?(auf )?serbisch|continue in serbian|in serbian)\b/i,
    lang: "sr",
  },
  {
    pattern: /\b(croatian|hrvatski|na hrvatskom|auf kroatisch)\b/i,
    lang: "hr",
  },
  {
    pattern: /\b(auf deutsch|in german|nur deutsch|continue in german)\b/i,
    lang: "de",
  },
  {
    pattern: /\b(in english|auf englisch|only english|nur englisch)\b/i,
    lang: "en",
  },
];

const LATIN_ENGLISH_PATTERN =
  /\b(please|thanks|thank you|could i|can i|i want|i'd like|allergies|order|hello|hi)\b/i;

const LATIN_ITALIAN_PATTERN =
  /\b(ciao|grazie|vorrei|per favore|acqua|birra|prego)\b/i;

/** German without umlauts (mobile keyboards, typos): "ein grosses bier bitte". */
const LATIN_GERMAN_PATTERN =
  /\b(bitte|danke|ein|eine|einen|einem|gross|groß|klein|bier|wasser|wein|cola|kaffee|tee|ich|möchte|mochte|hätte|hatte|bestellen|rechnung|kellner|hallo|guten|morgen|tag|abend|gerne|wollen|würde|wurde|noch|alles|spritz|pilsner|lager|weizen|radler)\b/i;

const UNSUPPORTED_SCRIPT_PATTERN =
  /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/;

/** Infer guest language from message text; venue language is the default. */
export function detectGuestMessageLanguage(
  guestMessage: string,
  menuLanguage: string
): GuestLanguageDetection {
  const text = guestMessage.trim();
  const venue = resolveAiPromptLanguage(menuLanguage);

  if (!text) {
    return { detected: venue, confidence: "high" };
  }

  for (const row of EXPLICIT_LANGUAGE_PREFERENCE) {
    if (row.pattern.test(text)) {
      return { detected: row.lang, confidence: "high" };
    }
  }

  if (UNSUPPORTED_SCRIPT_PATTERN.test(text)) {
    return { detected: "unknown", confidence: "high" };
  }

  if (/[\u0600-\u06FF]/.test(text)) return { detected: "ar", confidence: "high" };
  if (/[ђЂјЈљЉњЊћЋ]/.test(text)) {
    return { detected: venue === "hr" ? "hr" : "sr", confidence: "high" };
  }
  if (/[\u0400-\u04FF]/.test(text)) return { detected: "ru", confidence: "high" };
  if (/[ğüşöçıİĞÜŞÖÇ]/.test(text)) return { detected: "tr", confidence: "high" };
  if (/[äöüßÄÖÜ]/.test(text)) return { detected: "de", confidence: "high" };
  if (/[àâçéèêëïîôùûüœæ]/i.test(text)) return { detected: "fr", confidence: "high" };
  if (/[ñ¿¡]/i.test(text)) return { detected: "es", confidence: "high" };

  const lower = text.toLowerCase();
  if (LATIN_BALKAN_PATTERN.test(lower)) {
    if (venue === "hr") return { detected: "hr", confidence: "high" };
    if (venue === "sr") return { detected: "sr", confidence: "high" };
    return { detected: "sr", confidence: "high" };
  }

  if (LATIN_ITALIAN_PATTERN.test(lower)) {
    return { detected: "it", confidence: "high" };
  }

  if (LATIN_GERMAN_PATTERN.test(lower)) {
    return { detected: "de", confidence: "high" };
  }

  if (LATIN_ENGLISH_PATTERN.test(lower)) {
    return { detected: "en", confidence: "high" };
  }

  return { detected: venue, confidence: "low" };
}

/** @deprecated Prefer detectGuestMessageLanguage for confidence-aware handling. */
export function resolveGuestMessageLanguage(
  guestMessage: string,
  menuLanguage: string
): (typeof AI_SUPPORTED_LANGUAGES)[number] {
  const { detected } = detectGuestMessageLanguage(guestMessage, menuLanguage);
  if (detected === "unknown") {
    return resolveAiPromptLanguage(menuLanguage);
  }
  return detected;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
