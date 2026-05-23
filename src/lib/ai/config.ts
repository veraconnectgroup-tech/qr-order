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
  /** Max recommendations the model may return */
  maxRecommendations: 3,
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
] as const;

export function resolveAiPromptLanguage(language: string): (typeof AI_SUPPORTED_LANGUAGES)[number] {
  const normalized = language.trim().toLowerCase().slice(0, 2);
  if ((AI_SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized as (typeof AI_SUPPORTED_LANGUAGES)[number];
  }
  return "en";
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
