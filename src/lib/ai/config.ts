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
    "AI Concierge ist momentan nicht verfügbar.",
  /** Menu cache TTL in Redis */
  menuCacheTtlSeconds: 300,
  menuCacheKeyPrefix: "ai:menu:",
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

/** Infer response language from guest text; falls back to venue menu language. */
export function resolveGuestMessageLanguage(
  guestMessage: string,
  menuLanguage: string
): (typeof AI_SUPPORTED_LANGUAGES)[number] {
  const text = guestMessage.trim();
  if (!text) return resolveAiPromptLanguage(menuLanguage);

  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[ђЂјЈљЉњЊћЋ]/.test(text)) return "sr";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[ğüşöçıİĞÜŞÖÇ]/.test(text)) return "tr";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[àâçéèêëïîôùûüœæ]/i.test(text)) return "fr";
  if (/[ñ¿¡]/i.test(text)) return "es";

  return resolveAiPromptLanguage(menuLanguage);
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
