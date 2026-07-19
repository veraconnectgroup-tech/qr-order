/** AI Concierge — centralized configuration */

import {
  advanceLanguagePersistence,
  parseCodeSwitchedMessage,
  resolvePersistentResponseLanguage,
  type LanguagePersistenceState,
} from "@/lib/denis/cognition/conversation/code-switch-parser";
import {
  resolveAiGuestRetryMessage,
  resolveAiGuestUnavailableMessage,
} from "@/lib/ai/guest-error-messages";
import { detectGuestScript } from "@/lib/denis/cognition/conversation/script-detector";

export const AI_CONFIG = {
  /** Primary chat model */
  model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1",
  /** Fallback when primary fails or is unavailable */
  fallbackModel: process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-4.1-nano",
  maxTokens: 500,
  temperature: 0.4,
  /** Credits debited per concierge turn (API layer) */
  creditsPerMessage: 1,
  /** Max curated recommendations (personal picks) */
  maxRecommendations: 3,
  /** Max menu items shown as tappable browse list in chat */
  maxBrowseRecommendations: 12,
  /** OpenAI request timeout */
  requestTimeoutMs: 10_000,
  /** OpenAI prompt prefix caching (gpt-4.1+). Disable with OPENAI_PROMPT_CACHING=false. */
  promptCachingEnabled: process.env.OPENAI_PROMPT_CACHING?.trim() !== "false",
  /** Default cache bucket for Denis perceive/narrate system prompts. */
  promptCacheKeyPrefix: "denis-v1",
  /** Initial attempt + retries (3 attempts = 2 retries) */
  maxRetryAttempts: 3,
  /** Base delay for exponential backoff (ms): 500ms, 1000ms */
  retryBaseDelayMs: 500,
  /** Guest AI session max duration */
  sessionTimeoutMs: 60 * 60 * 1000,
  /** Max stored messages per AI session (user + assistant) */
  maxMessagesPerSession: 80,
  /** One extra OpenAI call when JSON parse fails */
  parseRetryAttempts: 1,
  /** @deprecated Use resolveAiGuestRetryMessage(language) — kept for tests/legacy. */
  fallbackMessage: "Sorry, please try again.",
  /** @deprecated Use resolveAiGuestUnavailableMessage(language). */
  circuitBreakerMessage:
    "The AI assistant is temporarily unavailable. You can still order normally.",
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
  /** Static system prompt budget excluding MENU text (chars/4 estimate). */
  maxSystemPromptTokens: 3000,
} as const;

/** Rough token estimate for prompt budgeting (OpenAI ~4 chars/token). */
export function estimatePromptTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

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
  /** Dominant language for reply (may differ from single-token detection when code-switching). */
  responseLanguage?: (typeof AI_SUPPORTED_LANGUAGES)[number];
  /** Extracted menu/product terms across languages in the utterance. */
  menuItemHints?: string[];
  casualMode?: boolean;
  dialect?: "sr" | "hr" | "bs" | null;
  codeSwitched?: boolean;
  responseScript?: "latin" | "cyrillic";
  languageConfidence?: number;
};

export type DetectGuestMessageLanguageOptions = {
  menuScript?: "latin" | "cyrillic";
  preferredScript?: "latin" | "cyrillic" | null;
  languagePersistence?: LanguagePersistenceState | null;
};

const LATIN_BALKAN_PATTERN =
  /\b(jedn[auo]|molim|hvala|naru[čc]|poru[čc]|potvrd|donesi|donij|imam|alergij|pivo|cola|kola|jo[sš]|sve|nema|mo[žz]e|moze|želim|zelim|ho[ćc]u|hocu|imate|zdravo|dobar|gde|gdje|sta|šta|kako|si|ste|sam|smo|brate|bre|legendo|legend|ćao|cao|jel|jesi|nisi|reci|recite|ajde|idem|idemo|super|odlično|odlicno|samo|sad|sada|kasnije|hajde|izvini|izvinite|naravno|važi|vazi|može|moze|mali|velik[oa]?|ra[čc]un|racun|po[sš]alji|posalji|denis[e]?)\b/i;

/** Extended Balkan hints — typos/slang/menu questions not in ordering regex (Prompt 5). */
const BALKAN_HINTS =
  /\b(šta|sta|imate|želim|zelim|zelite|ho[ćc]u|hocu|mo[žz]e|moze|daj|ne[šs]to|nesto|koliko|ko[sš]ta|kosta|jel|postoji|alergij|vegans?|gladn|žedn|zedn|preporu[čc]|preporuc|legendo|brate|ćao|cao|zdravo|ej|hej|alo|dobar\s*dan|dobro\s*jutro|dobro\s*ve[čc]e|dobro\s*vece)\b/i;

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
  /\b(bitte|danke|ein|eine|einen|einem|zwei|drei|und|gross|groß|klein|bier|wasser|wein|cola|kaffee|tee|ich|möchte|mochte|hätte|hatte|bestellen|rechnung|kellner|hallo|guten|morgen|tag|abend|gerne|wollen|würde|wurde|noch|alles|spritz|pilsner|lager|weizen|radler|burger)\b/i;

const UNSUPPORTED_SCRIPT_PATTERN =
  /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/;

/** Infer guest language from message text; venue language is the default. */
export function detectGuestMessageLanguage(
  guestMessage: string,
  menuLanguage: string,
  options?: DetectGuestMessageLanguageOptions
): GuestLanguageDetection {
  const text = guestMessage.trim();
  const venue = resolveAiPromptLanguage(menuLanguage);
  const script = detectGuestScript(text, {
    menuScript: options?.menuScript ?? "latin",
    preferredScript: options?.preferredScript ?? null,
  });

  const workingText = script.normalizedLatinText.trim() || text;

  if (!workingText) {
    return { detected: venue, confidence: "high", responseScript: script.responseScript };
  }

  for (const row of EXPLICIT_LANGUAGE_PREFERENCE) {
    if (row.pattern.test(workingText)) {
      const persistence = advanceLanguagePersistence({
        detectedLanguage: row.lang,
        prior: options?.languagePersistence ?? null,
        message: workingText,
        script: script.responseScript,
      });
      return {
        detected: row.lang,
        confidence: "high",
        responseLanguage: row.lang,
        responseScript: script.responseScript,
        languageConfidence: persistence.confidence,
        casualMode: false,
      };
    }
  }

  if (UNSUPPORTED_SCRIPT_PATTERN.test(workingText)) {
    return { detected: "unknown", confidence: "high", responseScript: script.responseScript };
  }

  if (/[\u0600-\u06FF]/.test(workingText)) {
    return { detected: "ar", confidence: "high", responseScript: script.responseScript };
  }

  const codeSwitch = parseCodeSwitchedMessage(workingText, {
    venueLanguage: venue,
    fallbackLanguage: venue,
  });

  if (script.inputScript === "cyrillic" || /[ђЂјЈљЉњЊћЋ]/.test(text)) {
    const detected = venue === "hr" ? "hr" : "sr";
    const persistence = advanceLanguagePersistence({
      detectedLanguage: detected,
      prior: options?.languagePersistence ?? null,
      message: workingText,
      script: script.responseScript,
    });
    const responseLanguage = resolvePersistentResponseLanguage({
      detectedLanguage: detected,
      persistence,
    });
    return {
      detected,
      confidence: "high",
      responseLanguage,
      menuItemHints: codeSwitch.menuItemHints,
      casualMode: codeSwitch.casualMode,
      dialect: codeSwitch.dialect,
      codeSwitched: codeSwitch.codeSwitched,
      responseScript: script.responseScript,
      languageConfidence: persistence.confidence,
    };
  }

  if (/[\u0400-\u04FF]/.test(text)) {
    return { detected: "ru", confidence: "high", responseScript: script.responseScript };
  }
  if (/[ğüşöçıİĞÜŞÖÇ]/.test(workingText)) {
    return { detected: "tr", confidence: "high", responseScript: script.responseScript };
  }
  if (/[äöüßÄÖÜ]/.test(workingText)) {
    return { detected: "de", confidence: "high", responseScript: script.responseScript };
  }
  if (/[àâçéèêëïîôùûüœæ]/i.test(workingText)) {
    return { detected: "fr", confidence: "high", responseScript: script.responseScript };
  }
  if (/[ñ¿¡]/i.test(workingText)) {
    return { detected: "es", confidence: "high", responseScript: script.responseScript };
  }

  if (codeSwitch.codeSwitched || codeSwitch.menuItemHints.length > 0) {
    const detected = codeSwitch.dominantLanguage;
    const persistence = advanceLanguagePersistence({
      detectedLanguage: detected,
      prior: options?.languagePersistence ?? null,
      message: workingText,
      script: script.responseScript,
    });
    const responseLanguage = resolvePersistentResponseLanguage({
      detectedLanguage: codeSwitch.responseLanguage,
      persistence,
    });
    return {
      detected,
      confidence: "high",
      responseLanguage,
      menuItemHints: codeSwitch.menuItemHints,
      casualMode: codeSwitch.casualMode,
      dialect: codeSwitch.dialect,
      codeSwitched: codeSwitch.codeSwitched,
      responseScript: script.responseScript,
      languageConfidence: persistence.confidence,
    };
  }

  const lower = workingText.toLowerCase();
  if (LATIN_BALKAN_PATTERN.test(lower) || BALKAN_HINTS.test(lower)) {
    const detected =
      codeSwitch.dialect === "hr" || venue === "hr"
        ? "hr"
        : codeSwitch.dialect === "sr" || venue === "sr"
          ? "sr"
          : "sr";
    const persistence = advanceLanguagePersistence({
      detectedLanguage: detected,
      prior: options?.languagePersistence ?? null,
      message: workingText,
      script: script.responseScript,
    });
    const responseLanguage = resolvePersistentResponseLanguage({
      detectedLanguage: detected,
      persistence,
    });
    return {
      detected,
      confidence: "high",
      responseLanguage,
      menuItemHints: codeSwitch.menuItemHints,
      casualMode: codeSwitch.casualMode,
      dialect: codeSwitch.dialect ?? (detected === "hr" ? "hr" : "sr"),
      responseScript: script.responseScript,
      languageConfidence: persistence.confidence,
    };
  }

  if (LATIN_ITALIAN_PATTERN.test(lower)) {
    return { detected: "it", confidence: "high", responseScript: script.responseScript };
  }

  if (LATIN_GERMAN_PATTERN.test(lower)) {
    return { detected: "de", confidence: "high", responseScript: script.responseScript };
  }

  if (LATIN_ENGLISH_PATTERN.test(lower)) {
    const persistence = advanceLanguagePersistence({
      detectedLanguage: "en",
      prior: options?.languagePersistence ?? null,
      message: workingText,
      script: script.responseScript,
    });
    const responseLanguage = resolvePersistentResponseLanguage({
      detectedLanguage: "en",
      persistence,
    });
    return {
      detected: "en",
      confidence: venue === "de" ? "high" : "high",
      responseLanguage,
      menuItemHints: codeSwitch.menuItemHints,
      casualMode: codeSwitch.casualMode,
      responseScript: script.responseScript,
      languageConfidence: persistence.confidence,
    };
  }

  const persistence = advanceLanguagePersistence({
    detectedLanguage: venue,
    prior: options?.languagePersistence ?? null,
    message: workingText,
    script: script.responseScript,
  });

  return {
    detected: venue,
    confidence: "low",
    responseLanguage: resolvePersistentResponseLanguage({
      detectedLanguage: venue,
      persistence,
    }),
    responseScript: script.responseScript,
    languageConfidence: persistence.confidence,
  };
}

/** @deprecated Prefer detectGuestMessageLanguage for confidence-aware handling. */
export function resolveGuestMessageLanguage(
  guestMessage: string,
  menuLanguage: string,
  options?: DetectGuestMessageLanguageOptions
): (typeof AI_SUPPORTED_LANGUAGES)[number] {
  const detection = detectGuestMessageLanguage(guestMessage, menuLanguage, options);
  if (detection.responseLanguage) {
    return detection.responseLanguage;
  }
  if (detection.detected === "unknown") {
    return resolveAiPromptLanguage(menuLanguage);
  }
  return detection.detected;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function buildDenisPromptCacheKey(
  surface: "perceive" | "narrate" | "slot-extract",
  scope?: string | null
): string {
  const prefix = AI_CONFIG.promptCacheKeyPrefix;
  const scoped = scope?.trim();
  return scoped ? `${prefix}:${surface}:${scoped}` : `${prefix}:${surface}`;
}

export { resolveAiGuestRetryMessage, resolveAiGuestUnavailableMessage };
