import { AI_BLOCKED_PATTERNS } from "@/lib/ai/config";

export type AbuseSignal =
  | "rate_exceeded"
  | "prompt_injection"
  | "jailbreak_attempt"
  | "gibberish_flood"
  | "offensive_content"
  | "data_extraction"
  | "order_manipulation";

export type AbuseAction =
  | "allow"
  | "warn"
  | "throttle"
  | "block_session"
  | "notify_staff";

export type AbuseVerdict = {
  blocked: boolean;
  signal: AbuseSignal | null;
  action: AbuseAction;
  cooldownSeconds: number;
  /** Guest-facing hint when action is warn or block. */
  guestMessage: string | null;
  /** Response delay when action is throttle. */
  delaySeconds: number;
  notifyStaff: boolean;
};

export type AbuseTracker = {
  sessionId: string;
  messageCount: number;
  windowStart: number;
  warnings: number;
  signals: AbuseSignal[];
  blockedUntil: number | null;
  permanentlyBlocked: boolean;
};

export const ABUSE_LIMITS = {
  maxMessagesPerMinute: 20,
  throttledMaxPerMinute: 5,
  blockCooldownSeconds: 600,
  throttleDelaySeconds: 3,
  rateWindowMs: 60_000,
  maxSessionsPerIpHour: 100,
} as const;

const WARN_GUEST_MESSAGE =
  "Molimo vas za korektnu komunikaciju.";
const BLOCK_GUEST_MESSAGE =
  "Sesija je privremeno blokirana zbog zloupotrebe. Molimo sačekajte ili pozovite osoblje.";

/** Food/order context — "ignore the onions" is OK. */
const IGNORE_FOOD_CONTEXT =
  /\bignore\s+(the\s+)?(onions?|salad|tomatoes?|pickles?|cheese|sauce|dressing|garlic|peppers?|mushrooms?|olives?|cucumber|lettuce|bacon|ham|meat|gluten|lactose|nuts?|allerg(?:y|en)|extras?|garnish|spicy|ice|sugar|salt|pepper|mustard|ketchup|mayo)\b/i;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?)/i,
  /new\s+system\s+prompt/i,
  /\b(system|developer)\s+prompt\b/i,
  /reveal\s+(your|the)\s+(system|hidden|secret)\s+(prompt|instructions?)/i,
  /show\s+(system|your)\s+(message|prompt|instructions?)/i,
  /what\s+are\s+your\s+instructions/i,
  /output\s+(the\s+)?(system|initial)\s+prompt/i,
  /<\s*\/?\s*(system|assistant|user)\s*>/i,
  /\bbypass\s+(safety|content|moderation)\b/i,
];

const JAILBREAK_PATTERNS: RegExp[] = [
  /you\s+are\s+now\s+(a|an)\s+/i,
  /\bpretend\s+(you\s+are|to\s+be)\b/i,
  /\bact\s+as\s+(a|an|if)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /\bact\s+as\s+if\s+you\s+have\s+no\s+restrictions\b/i,
];

const DATA_EXTRACTION_PATTERNS: RegExp[] = [
  /\b(api\s+key|secret\s+key|env\s+var|database\s+url|supabase|stripe\s+key)\b/i,
  /\b(internal|admin|staff)\s+(password|credentials?|token)\b/i,
  /\bdump\s+(the\s+)?(database|schema|tables?)\b/i,
  /\blist\s+all\s+(users?|customers?|orders?)\b/i,
];

/** Heavy profanity only — mild frustration allowed. */
const OFFENSIVE_PATTERNS: RegExp[] = [
  /\b(f+u+c+k+|s+h+i+t+|b+i+t+c+h+|c+u+n+t+|n+i+g+g+|f+a+g+g+)\b/i,
  /\b(jebi\s+se|pi[cč]ka|kurv[aio]|peder[u]?)\b/i,
];

const ORDER_MANIPULATION_PATTERNS: RegExp[] = [
  /\b(order|naruci|naruči|buy|kupi)\b.*\b(0\s*(rsd|din|eur|€|\$|free|besplatno))\b/i,
  /\b(0\s*(rsd|din|eur|€|\$))\b.*\b(order|total|cena|price)\b/i,
  /\bset\s+(price|total|cena)\s+(to\s+)?0\b/i,
  /\b(discount|popust)\s+100\s*%/i,
];

const GIBBERISH_MIN_LENGTH = 12;
const GIBBERISH_RATIO = 0.72;

function normalizeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function tryDecodeInjectionPayload(text: string): string {
  const b64 = text.match(/\b([A-Za-z0-9+/]{20,}={0,2})\b/);
  if (b64) {
    try {
      const decoded = Buffer.from(b64[1]!, "base64").toString("utf8");
      if (/ignore|system prompt|instructions|jailbreak/i.test(decoded)) {
        return `${text} ${decoded}`;
      }
    } catch {
      // Not valid base64.
    }
  }

  const hex = text.match(/\b([0-9a-fA-F]{24,})\b/);
  if (hex) {
    try {
      const decoded = Buffer.from(hex[1]!, "hex").toString("utf8");
      if (/ignore|system prompt|instructions|jailbreak/i.test(decoded)) {
        return `${text} ${decoded}`;
      }
    } catch {
      // Not valid hex.
    }
  }

  return text;
}

function isGibberishFlood(text: string): boolean {
  if (text.length < GIBBERISH_MIN_LENGTH) return false;
  const letters = text.replace(/[^a-zA-Z\u0400-\u04FF\u0600-\u06FF]/g, "");
  if (letters.length < 4) return true;
  const vowels = letters.replace(/[^aeiouAEIOU\u0430\u0435\u0438\u043e\u0443\u044b\u044e\u044f\u0430\u0648\u064a\u0648\u064a\u0647]/g, "");
  const ratio = 1 - vowels.length / letters.length;
  if (ratio >= GIBBERISH_RATIO) return true;
  if (/(.)\1{5,}/.test(text)) return true;
  if (/^[\W\d\s]+$/u.test(text)) return true;
  return false;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Detect abuse signals from guest text — context-aware, false-positive safe. */
export function detectAbuseSignals(input: string): AbuseSignal[] {
  const normalized = normalizeInput(input);
  if (!normalized) return [];

  const expanded = tryDecodeInjectionPayload(normalized);
  const signals: AbuseSignal[] = [];

  if (IGNORE_FOOD_CONTEXT.test(normalized)) {
    // Skip prompt-injection heuristics for benign food exclusions.
  } else if (matchesAny(expanded, PROMPT_INJECTION_PATTERNS)) {
    signals.push("prompt_injection");
  } else if (matchesAny(expanded, AI_BLOCKED_PATTERNS)) {
    signals.push("prompt_injection");
  }

  if (matchesAny(expanded, JAILBREAK_PATTERNS)) {
    signals.push("jailbreak_attempt");
  }
  if (matchesAny(expanded, DATA_EXTRACTION_PATTERNS)) {
    signals.push("data_extraction");
  }
  if (matchesAny(normalized, ORDER_MANIPULATION_PATTERNS)) {
    signals.push("order_manipulation");
  }
  if (matchesAny(normalized, OFFENSIVE_PATTERNS)) {
    signals.push("offensive_content");
  }
  if (isGibberishFlood(normalized)) {
    signals.push("gibberish_flood");
  }

  return [...new Set(signals)];
}

export function emptyAbuseTracker(sessionId: string, now = Date.now()): AbuseTracker {
  return {
    sessionId,
    messageCount: 0,
    windowStart: now,
    warnings: 0,
    signals: [],
    blockedUntil: null,
    permanentlyBlocked: false,
  };
}

function rollRateWindow(tracker: AbuseTracker, now: number): AbuseTracker {
  if (now - tracker.windowStart >= ABUSE_LIMITS.rateWindowMs) {
    return {
      ...tracker,
      messageCount: 0,
      windowStart: now,
    };
  }
  return tracker;
}

function isSessionBlocked(tracker: AbuseTracker, now: number): boolean {
  if (tracker.permanentlyBlocked) return true;
  if (tracker.blockedUntil != null && tracker.blockedUntil > now) return true;
  return false;
}

function resolveEscalationAction(
  offenseCount: number,
  signal: AbuseSignal | null
): Pick<AbuseVerdict, "action" | "blocked" | "cooldownSeconds" | "delaySeconds" | "notifyStaff" | "guestMessage"> {
  const severe =
    signal === "prompt_injection" ||
    signal === "jailbreak_attempt" ||
    signal === "data_extraction" ||
    signal === "order_manipulation";

  if (severe && offenseCount <= 1) {
    return {
      action: "block_session",
      blocked: true,
      cooldownSeconds: ABUSE_LIMITS.blockCooldownSeconds,
      delaySeconds: 0,
      notifyStaff: true,
      guestMessage: BLOCK_GUEST_MESSAGE,
    };
  }

  if (offenseCount <= 1) {
    return {
      action: "warn",
      blocked: false,
      cooldownSeconds: 0,
      delaySeconds: 0,
      notifyStaff: false,
      guestMessage: WARN_GUEST_MESSAGE,
    };
  }
  if (offenseCount === 2) {
    return {
      action: "throttle",
      blocked: false,
      cooldownSeconds: 0,
      delaySeconds: ABUSE_LIMITS.throttleDelaySeconds,
      notifyStaff: false,
      guestMessage: null,
    };
  }
  if (offenseCount === 3) {
    return {
      action: "block_session",
      blocked: true,
      cooldownSeconds: ABUSE_LIMITS.blockCooldownSeconds,
      delaySeconds: 0,
      notifyStaff: false,
      guestMessage: BLOCK_GUEST_MESSAGE,
    };
  }

  return {
    action: "notify_staff",
    blocked: true,
    cooldownSeconds: 0,
    delaySeconds: 0,
    notifyStaff: true,
    guestMessage: BLOCK_GUEST_MESSAGE,
  };
}

function effectiveRateLimit(tracker: AbuseTracker): number {
  if (tracker.warnings >= 2) return ABUSE_LIMITS.throttledMaxPerMinute;
  return ABUSE_LIMITS.maxMessagesPerMinute;
}

/**
 * Evaluate guest input against session abuse tracker (read-only).
 * Staff messages are not counted toward rate limits.
 */
export function evaluateAbuse(
  input: string,
  tracker: AbuseTracker,
  opts: { isStaffMessage?: boolean; now?: number } = {}
): AbuseVerdict {
  const now = opts.now ?? Date.now();
  const working = rollRateWindow(tracker, now);
  const countsTowardRate = !opts.isStaffMessage;
  const projectedCount = working.messageCount + (countsTowardRate ? 1 : 0);

  if (isSessionBlocked(working, now)) {
    return {
      blocked: true,
      signal: null,
      action: working.permanentlyBlocked ? "notify_staff" : "block_session",
      cooldownSeconds:
        working.blockedUntil != null
          ? Math.max(0, Math.ceil((working.blockedUntil - now) / 1000))
          : 0,
      guestMessage: BLOCK_GUEST_MESSAGE,
      delaySeconds: 0,
      notifyStaff: working.permanentlyBlocked,
    };
  }

  const signals = detectAbuseSignals(input);
  const primarySignal = signals[0] ?? null;

  if (countsTowardRate && projectedCount > effectiveRateLimit(working)) {
    const offenseCount = working.warnings + 1;
    const escalation = resolveEscalationAction(offenseCount, "rate_exceeded");
    return {
      blocked: escalation.blocked,
      signal: "rate_exceeded",
      action: escalation.action,
      cooldownSeconds: escalation.cooldownSeconds,
      guestMessage: escalation.guestMessage,
      delaySeconds: escalation.delaySeconds,
      notifyStaff: escalation.notifyStaff,
    };
  }

  if (signals.length === 0) {
    return {
      blocked: false,
      signal: null,
      action: "allow",
      cooldownSeconds: 0,
      guestMessage: null,
      delaySeconds: 0,
      notifyStaff: false,
    };
  }

  const offenseCount = working.warnings + 1;
  const escalation = resolveEscalationAction(offenseCount, primarySignal);

  return {
    blocked: escalation.blocked,
    signal: primarySignal,
    action: escalation.action,
    cooldownSeconds: escalation.cooldownSeconds,
    guestMessage: escalation.guestMessage,
    delaySeconds: escalation.delaySeconds,
    notifyStaff: escalation.notifyStaff,
  };
}

/** Apply verdict to tracker after a message is processed. */
export function applyAbuseVerdictToTracker(
  tracker: AbuseTracker,
  verdict: AbuseVerdict,
  opts: { isStaffMessage?: boolean; now?: number } = {}
): AbuseTracker {
  const now = opts.now ?? Date.now();
  let next = rollRateWindow(tracker, now);

  if (!opts.isStaffMessage) {
    next = { ...next, messageCount: next.messageCount + 1 };
  }

  if (verdict.signal || verdict.action !== "allow") {
    next = {
      ...next,
      signals: verdict.signal ? [...next.signals, verdict.signal] : next.signals,
      warnings:
        verdict.action === "allow" && !verdict.signal
          ? next.warnings
          : next.warnings + 1,
    };
  }

  if (verdict.action === "block_session" || verdict.action === "notify_staff") {
    if (verdict.action === "notify_staff" || next.warnings >= 4) {
      next = { ...next, permanentlyBlocked: true, blockedUntil: null };
    } else if (verdict.cooldownSeconds > 0) {
      next = {
        ...next,
        blockedUntil: now + verdict.cooldownSeconds * 1000,
      };
    }
  }

  return next;
}

/** Combined evaluate + tracker update for a single guest turn. */
export function evaluateAndTrackAbuse(
  input: string,
  tracker: AbuseTracker,
  opts: { isStaffMessage?: boolean; now?: number } = {}
): { verdict: AbuseVerdict; tracker: AbuseTracker } {
  const now = opts.now ?? Date.now();
  const working = rollRateWindow(tracker, now);
  const verdict = evaluateAbuse(input, working, { ...opts, now });
  const updated = applyAbuseVerdictToTracker(working, verdict, { ...opts, now });
  return { verdict, tracker: updated };
}

export function abuseAuditLogPayload(input: {
  sessionId: string;
  verdict: AbuseVerdict;
  messagePreview: string;
}): Record<string, unknown> {
  return {
    kind: "denis.abuse",
    sessionId: input.sessionId,
    signal: input.verdict.signal,
    action: input.verdict.action,
    blocked: input.verdict.blocked,
    notifyStaff: input.verdict.notifyStaff,
    preview: input.messagePreview.slice(0, 120),
    at: new Date().toISOString(),
  };
}
