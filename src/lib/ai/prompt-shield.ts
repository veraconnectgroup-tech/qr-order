import { AI_BLOCKED_PATTERNS } from "@/lib/ai/config";
import { logger } from "@/lib/logger";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

export type ShieldResult = {
  safe: boolean;
  score: number;
  reason?: string;
  layer: "regex" | "heuristic" | "classifier" | "output";
};

/** Guest-facing copy when input/output is blocked — never expose shield internals. */
export const SHIELD_GRACEFUL_GUEST_MESSAGE =
  "Možete li to drugačije formulisati? Tu sam za meni!";

export const SHIELD_BLOCK_ALERT_THRESHOLD = 3;
const SHIELD_TRACKER_TTL_SEC = 86_400;

export type ShieldSessionState = {
  sessionId: string;
  blockCount: number;
  flagged: boolean;
  notifyStaff: boolean;
};

const SUPERSCRIPT_DIGIT_MAP: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

/** Production injection patterns — extends config list for bare "ignore instructions". */
const PRODUCTION_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?instructions/i,
  /\byou\s+are\s+now\b/i,
  /\bsystem\s+prompt\b/i,
  /\bgive\s+me\s+free\b/i,
  /\bfree\s+(food|order|meal|items?)\b/i,
  /\bno\s+charge\b/i,
  /\bzero\s+euro\b/i,
];

const DELIMITER_PATTERNS: RegExp[] = [
  /\bEND_(SYSTEM|ASSISTANT|USER|TURN)\b/i,
  /```(system|prompt|instructions)/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /\bNew system prompt\s*:/i,
  /\bTranslate\s*:\s*END_/i,
];

const ROLE_PLAY_PATTERNS: RegExp[] = [
  /pretend\s+you\s+are/i,
  /roleplay\s+as/i,
  /from\s+now\s+on\s+you/i,
  /act\s+as\s+(a|an)\s+(?!waiter|server|host)/i,
];

const INDIRECT_INJECTION_PATTERNS: RegExp[] = [
  /what\s+(does|is|are)\s+(your|the)\s+(system|hidden|secret)\s+(prompt|instructions?)/i,
  /(tell|show|reveal|print|output|repeat|describe)\s+(me\s+)?(your|the)\s+(system|initial|hidden|secret)\s+(prompt|instructions?)/i,
  /what\s+are\s+your\s+(rules|guidelines|restrictions)/i,
  /do\s+you\s+have\s+(a\s+)?system\s+prompt/i,
  /question\s+\d+.*question\s+\d+.*(rules|prompt|instructions)/i,
];

const OUTPUT_LEAK_PATTERNS: RegExp[] = [
  /\b(you are|your role is)\s+(denis|an ai|a language model|gpt|chatgpt|claude)/i,
  /\b(system prompt|developer message|hidden instructions?)\s*(:|is|are)/i,
  /\bmy instructions (say|tell|are)/i,
  /\bI('m| am)\s+(an?\s+)?(AI|artificial intelligence|language model|LLM|chatbot|large language model)\b/i,
  /\b(as|I'm)\s+a\s+language\s+model\b/i,
  /\bI('m| am)\s+just\s+(an?\s+)?(AI|bot|program|computer)\b/i,
  /```(sql|typescript|javascript|python|bash)/i,
  /\b(SELECT|INSERT|UPDATE|DELETE)\s+.+\s+FROM\s+/i,
  /\bDROP\s+TABLE\b/i,
  /\bprocess\.env\b/,
  /\bOPENAI_API_KEY\b/,
  /\b(SK|pk)_(live|test)_[A-Za-z0-9]+\b/,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

const OUTPUT_DOMAIN_ESCAPE_PATTERNS: RegExp[] = [
  /\b(write|generate|create)\s+(me\s+)?(a\s+)?(python|javascript|typescript|java|c\+\+)\s+(script|program|code)/i,
  /\b(hack|exploit|malware|ransomware)\b/i,
];

const HOMOGLYPH_MAP: Record<string, string> = {
  ...SUPERSCRIPT_DIGIT_MAP,
  ο: "o",
  о: "o",
  а: "a",
  е: "e",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  г: "r",
};

/** Benign food exclusions — "ignore the onions" must pass. */
const IGNORE_FOOD_CONTEXT =
  /\bignore\s+(the\s+)?(onions?|salad|tomatoes?|pickles?|cheese|sauce|dressing|garlic|peppers?|mushrooms?|olives?|cucumber|lettuce|bacon|ham|meat|gluten|lactose|nuts?|allerg(?:y|en)|extras?|garnish|spicy|ice|sugar|salt|pepper|mustard|ketchup|mayo)\b/i;

/** Zero-width, bidi overrides, word joiners — strip before matching. */
export function stripInvisibleAndBidiChars(input: string): string {
  return input.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "");
}

function shieldTrackerKey(sessionId: string): string {
  return `denis:shield:${sessionId}`;
}

/** Normalize unicode confusables before pattern matching. */
export function normalizeForScreening(input: string): string {
  let normalized = stripInvisibleAndBidiChars(input);
  normalized = normalized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  normalized = normalized.replace(
    /[\u2070-\u2079\u2080-\u2089]/g,
    (char) => HOMOGLYPH_MAP[char] ?? char
  );

  normalized = normalized.replace(
    /[οоаерсухг]/g,
    (char) => HOMOGLYPH_MAP[char] ?? char
  );

  normalized = normalized
    .replace(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replace(/(?<=[a-z])1(?=[a-z])/g, "i");

  return normalized.toLowerCase();
}

function decodeBase64Segment(segment: string): string | null {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(segment, "base64").toString("utf8");
    }
    return atob(segment);
  } catch {
    return null;
  }
}

function looksLikeSuspiciousBase64(input: string): boolean {
  const matches = input.match(/[A-Za-z0-9+/]{20,}(?:={0,2})?/g);
  if (!matches) return false;

  for (const raw of matches) {
    const segment = raw.replace(/=+$/, "");
    if (segment.length < 20) continue;
    const padded = segment.replace(/=+$/, "");
    const decodeTarget =
      padded.length % 4 === 0
        ? segment
        : `${padded}${"=".repeat((4 - (padded.length % 4)) % 4)}`;
    const decoded = decodeBase64Segment(decodeTarget);
    if (!decoded) continue;

    const normalized = normalizeForScreening(decoded);
    if (
      /ignore\s+(all\s+)?(previous|prior|instructions)/.test(normalized) ||
      /system\s+prompt/.test(normalized) ||
      /you\s+are\s+now/.test(normalized)
    ) {
      return true;
    }
  }

  return false;
}

function block(
  score: number,
  reason: string,
  layer: ShieldResult["layer"]
): ShieldResult {
  return { safe: false, score, reason, layer };
}

export function isBenignFoodExclusion(input: string): boolean {
  return IGNORE_FOOD_CONTEXT.test(normalizeForScreening(input));
}

function matchesProductionInjection(text: string): boolean {
  if (isBenignFoodExclusion(text)) return false;
  const normalized = normalizeForScreening(text);
  const patterns = [...AI_BLOCKED_PATTERNS, ...PRODUCTION_INJECTION_PATTERNS];
  return patterns.some(
    (pattern) => pattern.test(text) || pattern.test(normalized)
  );
}

/** Layer 1: regex patterns from config + production extensions. */
export function regexScreen(input: string): ShieldResult | null {
  const cleaned = stripInvisibleAndBidiChars(input);

  if (matchesProductionInjection(cleaned)) {
    return block(0.95, "blocked_pattern", "regex");
  }

  for (const pattern of AI_BLOCKED_PATTERNS) {
    if (pattern.test(cleaned)) {
      return block(0.95, "blocked_pattern", "regex");
    }
  }

  const normalized = normalizeForScreening(cleaned);
  for (const pattern of [...AI_BLOCKED_PATTERNS, ...PRODUCTION_INJECTION_PATTERNS]) {
    if (pattern.test(normalized)) {
      return block(0.9, "blocked_pattern_unicode", "regex");
    }
  }

  return null;
}

/** Layer 2: fast heuristic screening (no API call). */
export function heuristicScreen(input: string): ShieldResult | null {
  const cleaned = stripInvisibleAndBidiChars(input);
  const normalized = normalizeForScreening(cleaned);

  if (/[\u202E]/.test(input)) {
    return block(0.88, "rtl_override", "heuristic");
  }

  for (const pattern of DELIMITER_PATTERNS) {
    if (pattern.test(cleaned) || pattern.test(normalized)) {
      return block(0.85, "delimiter_injection", "heuristic");
    }
  }

  if (!isBenignFoodExclusion(cleaned)) {
    for (const pattern of ROLE_PLAY_PATTERNS) {
      if (pattern.test(normalized)) {
        return block(0.75, "role_play_injection", "heuristic");
      }
    }

    for (const pattern of INDIRECT_INJECTION_PATTERNS) {
      if (pattern.test(normalized)) {
        return block(0.8, "indirect_injection", "heuristic");
      }
    }
  }

  if (normalized.length > 300) {
    return block(0.7, "unusual_length", "heuristic");
  }

  if (
    /[A-Za-z0-9+/]{20,}(?:={0,2})?/.test(cleaned) &&
    looksLikeSuspiciousBase64(cleaned)
  ) {
    return block(0.8, "base64_payload", "heuristic");
  }

  return null;
}

/** Layer 3: post-LLM output guardrails — leak prevention only. */
export function screenOutput(output: string): ShieldResult {
  const trimmed = stripInvisibleAndBidiChars(output).trim();
  if (!trimmed) {
    return { safe: true, score: 0, layer: "output" };
  }

  for (const pattern of OUTPUT_LEAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return block(0.9, "output_leak", "output");
    }
  }

  for (const pattern of OUTPUT_DOMAIN_ESCAPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return block(0.85, "output_domain_escape", "output");
    }
  }

  return { safe: true, score: 0, layer: "output" };
}

export function shieldGuestInput(input: string): ShieldResult | null {
  const regexResult = regexScreen(input);
  if (regexResult && !regexResult.safe) return regexResult;

  const heuristicResult = heuristicScreen(input);
  if (heuristicResult && !heuristicResult.safe) return heuristicResult;

  return null;
}

export function shieldGracefulGuestMessage(): string {
  return SHIELD_GRACEFUL_GUEST_MESSAGE;
}

export function buildSecurityBlockedPayload(input: {
  direction: "input" | "output";
  reason: string;
  layer: ShieldResult["layer"];
  preview: string;
  blockCount: number;
  sessionFlagged: boolean;
  traceId?: string;
}): Record<string, unknown> {
  return {
    type: "security.blocked",
    direction: input.direction,
    reason: input.reason,
    layer: input.layer,
    preview: input.preview.slice(0, 120),
    blockCount: input.blockCount,
    sessionFlagged: input.sessionFlagged,
    traceId: input.traceId ?? null,
    at: new Date().toISOString(),
  };
}

/** Track blocked attempts per session — 3+ triggers staff alert (Redis-backed). */
export async function recordShieldBlock(
  sessionId: string
): Promise<ShieldSessionState> {
  if (!sessionId) {
    return {
      sessionId: "",
      blockCount: 1,
      flagged: false,
      notifyStaff: false,
    };
  }

  const redis = getRedisClient();
  if (!redis) {
    return {
      sessionId,
      blockCount: 1,
      flagged: false,
      notifyStaff: false,
    };
  }

  const key = shieldTrackerKey(sessionId);

  try {
    const stored = await redis.get<{ blockCount: number; flagged: boolean }>(key);
    const blockCount = (stored?.blockCount ?? 0) + 1;
    const flagged = blockCount >= SHIELD_BLOCK_ALERT_THRESHOLD;
    const notifyStaff = blockCount === SHIELD_BLOCK_ALERT_THRESHOLD;

    await redis.set(
      key,
      { blockCount, flagged },
      { ex: SHIELD_TRACKER_TTL_SEC }
    );

    return { sessionId, blockCount, flagged, notifyStaff };
  } catch (error) {
    logRedisDegradation("denis.shield.tracker.write", error);
    return {
      sessionId,
      blockCount: 1,
      flagged: false,
      notifyStaff: false,
    };
  }
}

export function logShieldBlock(
  layer: ShieldResult["layer"],
  reason: string,
  inputPreview: string,
  direction: "input" | "output" = "input"
): void {
  logger.warn("Prompt shield blocked attempt", {
    layer,
    reason,
    direction,
    preview: inputPreview.slice(0, 120),
  });
}
