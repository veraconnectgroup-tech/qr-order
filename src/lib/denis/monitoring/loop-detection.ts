import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type LoopType =
  | "repeat_response"
  | "flip_flop"
  | "info_re_ask"
  | "dead_end"
  | "cart_ping_pong";

export type LoopDetection = {
  detected: boolean;
  type: LoopType | null;
  severity: "mild" | "stuck";
  recovery: LoopRecoveryAction;
};

export type LoopRecoveryAction =
  | { action: "rephrase"; hint: string; guestAnswer?: string }
  | { action: "escalate_staff"; reason: string }
  | { action: "reset_context"; keepCart: boolean }
  | { action: "offer_chips"; options: string[] };

export type ConversationMessage = {
  role: "guest" | "denis";
  text: string;
  at: string;
};

const SIMILARITY_THRESHOLD = 0.8;
const MAX_RECOVERY_ATTEMPTS = 2;

const ACTIONABLE_DENIS_PATTERN =
  /\b(naru[čc]|poru[čc]|dodaj|meni|cart|order|€|rsd|din|burger|pivo|pi[ćc]e|desert|ra[čc]un|status|preporu[čc]|predla[žz]em|imamo|€|\d+\s*(rsd|din|€))\b/i;

const CART_PING_GUEST_PATTERN =
  /\b(dodaj|skini|ukloni|obri[šs]i|remove|add|stavi|makni)\b/i;

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function guestTextFromEvent(
  eventType: string,
  payload: Record<string, unknown>
): string | null {
  if (eventType === "signal.message") {
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    return text || null;
  }
  if (eventType === "perception.ingested") {
    const frame = payload.frame;
    if (!frame || typeof frame !== "object") return null;
    const text =
      typeof (frame as Record<string, unknown>).normalizedText === "string"
        ? ((frame as Record<string, unknown>).normalizedText as string).trim()
        : "";
    return text || null;
  }
  return null;
}

function denisTextFromEvent(
  eventType: string,
  payload: Record<string, unknown>
): string | null {
  if (eventType === "tell.committed") {
    if (payload.source === "sense.proactive") return null;
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    return message || null;
  }
  if (eventType === "narration.sent") {
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    return message || null;
  }
  return null;
}

/** Extract guest/denis transcript lines from timeline rows. */
export function extractConversationMessages(
  timeline: DenisTimelineRow[]
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  for (const event of timeline) {
    const payload = asRecord(event.payload);
    const guestText = guestTextFromEvent(event.event_type, payload);
    if (guestText) {
      messages.push({ role: "guest", text: guestText, at: event.created_at });
      continue;
    }
    const denisText = denisTextFromEvent(event.event_type, payload);
    if (denisText) {
      messages.push({ role: "denis", text: denisText, at: event.created_at });
    }
  }

  return messages;
}

export function normalizeForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

/** Levenshtein similarity 0–1 (1 = identical). */
export function textSimilarity(a: string, b: string): number {
  const left = normalizeForCompare(a);
  const right = normalizeForCompare(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let i = 0; i < rows; i++) matrix[i]![0] = i;
  for (let j = 0; j < cols; j++) matrix[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  const distance = matrix[rows - 1]![cols - 1]!;
  const maxLen = Math.max(left.length, right.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

export function messagesAreSimilar(a: string, b: string): boolean {
  if (normalizeForCompare(a) === normalizeForCompare(b)) return true;
  return textSimilarity(a, b) >= SIMILARITY_THRESHOLD;
}

function isActionableDenisMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (ACTIONABLE_DENIS_PATTERN.test(trimmed)) return true;
  if (trimmed.includes("?") && trimmed.length >= 24) return true;
  return false;
}

function defaultChipOptions(language: string): string[] {
  const lang = language.slice(0, 2).toLowerCase();
  if (lang === "de") {
    return ["Speisekarte", "Getränk bestellen", "Kellner rufen"];
  }
  if (lang === "en") {
    return ["View menu", "Order a drink", "Call waiter"];
  }
  return ["Pogledaj meni", "Poruči piće", "Pozovi konobara"];
}

function detectRepeatResponse(
  denisMessages: string[]
): LoopDetection | null {
  if (denisMessages.length < 2) return null;

  const last = denisMessages[denisMessages.length - 1]!;
  let similarCount = 1;

  for (let i = denisMessages.length - 2; i >= 0; i--) {
    if (messagesAreSimilar(last, denisMessages[i]!)) {
      similarCount += 1;
    } else {
      break;
    }
  }

  if (similarCount < 2) return null;

  if (similarCount >= 3) {
    return {
      detected: true,
      type: "repeat_response",
      severity: "stuck",
      recovery: {
        action: "offer_chips",
        options: [],
      },
    };
  }

  return {
    detected: true,
    type: "repeat_response",
    severity: "mild",
    recovery: {
      action: "rephrase",
      hint: "Ne ponavljaj isti odgovor — probaj drugačiji pristup ili ponudi konkretne opcije.",
    },
  };
}

function detectFlipFlop(messages: ConversationMessage[]): LoopDetection | null {
  const denis = messages.filter((m) => m.role === "denis").map((m) => m.text);
  if (denis.length < 3) return null;

  const a = denis[denis.length - 3]!;
  const b = denis[denis.length - 2]!;
  const c = denis[denis.length - 1]!;

  if (
    messagesAreSimilar(a, c) &&
    !messagesAreSimilar(a, b) &&
    !messagesAreSimilar(b, c)
  ) {
    return {
      detected: true,
      type: "flip_flop",
      severity: "stuck",
      recovery: { action: "reset_context", keepCart: true },
    };
  }

  return null;
}

function questionsSameTopic(a: string, b: string): boolean {
  if (messagesAreSimilar(a, b)) return true;
  if (!a.includes("?") || !b.includes("?")) return false;

  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  const topicKeys = [
    "alerg",
    "naruc",
    "poruc",
    "pice",
    "meni",
    "placanj",
  ];
  return topicKeys.some((key) => na.includes(key) && nb.includes(key));
}

function detectInfoReAsk(messages: ConversationMessage[]): LoopDetection | null {
  const denisQuestions: Array<{ text: string; index: number }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg.role !== "denis" || !msg.text.includes("?")) continue;
    denisQuestions.push({ text: msg.text, index: i });
  }

  if (denisQuestions.length < 2) return null;

  const latest = denisQuestions[denisQuestions.length - 1]!;
  for (let q = denisQuestions.length - 2; q >= 0; q--) {
    const prior = denisQuestions[q]!;
    if (!questionsSameTopic(prior.text, latest.text)) continue;

    let guestAnswer: string | null = null;
    for (let i = prior.index + 1; i < latest.index; i++) {
      const between = messages[i];
      if (between?.role === "guest" && between.text.trim()) {
        guestAnswer = between.text.trim();
        break;
      }
    }

    if (guestAnswer) {
      return {
        detected: true,
        type: "info_re_ask",
        severity: "stuck",
        recovery: {
          action: "rephrase",
          hint: `Gost je već odgovorio: "${guestAnswer}". Koristi taj odgovor — ne pitaj ponovo.`,
          guestAnswer,
        },
      };
    }
  }

  return null;
}

function detectDeadEnd(denisMessages: string[]): LoopDetection | null {
  if (denisMessages.length < 3) return null;

  const tail = denisMessages.slice(-3);
  if (tail.every((line) => !isActionableDenisMessage(line))) {
    return {
      detected: true,
      type: "dead_end",
      severity: "stuck",
      recovery: {
        action: "offer_chips",
        options: [],
      },
    };
  }

  return null;
}

function detectCartPingPong(
  timeline: DenisTimelineRow[],
  messages: ConversationMessage[],
  windowSize: number
): LoopDetection | null {
  const recentEvents = timeline.slice(-windowSize);
  const draftChanges = recentEvents.filter(
    (row) => row.event_type === "draft.changed"
  );
  if (draftChanges.length >= 4) {
    return {
      detected: true,
      type: "cart_ping_pong",
      severity: "stuck",
      recovery: {
        action: "offer_chips",
        options: [],
      },
    };
  }

  const recentGuest = messages.filter((m) => m.role === "guest").slice(-4);
  if (recentGuest.length >= 4) {
    const pingPong = recentGuest.every((m) =>
      CART_PING_GUEST_PATTERN.test(m.text)
    );
    if (pingPong) {
      return {
        detected: true,
        type: "cart_ping_pong",
        severity: "stuck",
        recovery: {
          action: "offer_chips",
          options: defaultChipOptions("sr"),
        },
      };
    }
  }

  return null;
}

/**
 * Per-session loop detection over the last N timeline events.
 * Deterministic — no LLM.
 */
export function detectConversationLoop(
  timeline: DenisTimelineRow[],
  windowSize = 6
): LoopDetection {
  const none: LoopDetection = {
    detected: false,
    type: null,
    severity: "mild",
    recovery: { action: "rephrase", hint: "" },
  };

  if (!timeline.length) return none;

  const recentTimeline = timeline.slice(-windowSize);
  const messages = extractConversationMessages(recentTimeline);
  const denisMessages = messages
    .filter((m) => m.role === "denis")
    .map((m) => m.text);

  const detectors = [
    () => detectRepeatResponse(denisMessages),
    () => detectFlipFlop(messages),
    () => detectCartPingPong(recentTimeline, messages, windowSize),
    () => detectInfoReAsk(messages),
    () => detectDeadEnd(denisMessages),
  ];

  for (const run of detectors) {
    const hit = run();
    if (hit) return hit;
  }

  return none;
}

export function shouldSkipLlmForLoop(
  detection: LoopDetection,
  recoveryAttempts: number
): boolean {
  if (!detection.detected) return false;
  if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return true;
  return detection.severity === "stuck";
}

export function resolveLoopRecoveryAfterAttempts(
  detection: LoopDetection,
  recoveryAttempts: number
): LoopRecoveryAction {
  if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    return {
      action: "escalate_staff",
      reason: "max_recovery_attempts",
    };
  }
  return detection.recovery;
}

export type LoopRecoveryContent = {
  message: string;
  quickReplies: string[];
  contextInjection: string | null;
};

export function buildLoopRecoveryContent(input: {
  recovery: LoopRecoveryAction;
  language: string;
}): LoopRecoveryContent {
  const lang = input.language.slice(0, 2).toLowerCase();
  const chips =
    input.recovery.action === "offer_chips" &&
    input.recovery.options.length > 0
      ? input.recovery.options
      : defaultChipOptions(input.language);

  if (input.recovery.action === "escalate_staff") {
    if (lang === "de") {
      return {
        message:
          "Damit wir nicht im Kreis laufen — ich hole kurz jemanden vom Team, der Ihnen weiterhilft.",
        quickReplies: ["Kellner rufen", "Speisekarte"],
        contextInjection: null,
      };
    }
    if (lang === "en") {
      return {
        message:
          "So we don't go in circles — I'll get a team member to help you properly.",
        quickReplies: ["Call waiter", "View menu"],
        contextInjection: null,
      };
    }
    return {
      message:
        "Da se ne vrtimo u krug — javljam kolegu da vam pomogne odmah.",
      quickReplies: ["Pozovi konobara", "Pogledaj meni"],
      contextInjection: null,
    };
  }

  if (input.recovery.action === "reset_context") {
    const keepCart = input.recovery.keepCart;
    if (lang === "de") {
      return {
        message: keepCart
          ? "Kurzer Neustart — Ihr Warenkorb bleibt. Was darf es sein?"
          : "Kurzer Neustart — womit kann ich Ihnen helfen?",
        quickReplies: chips,
        contextInjection: null,
      };
    }
    if (lang === "en") {
      return {
        message: keepCart
          ? "Quick reset — your cart stays. What would you like next?"
          : "Quick reset — how can I help you now?",
        quickReplies: chips,
        contextInjection: null,
      };
    }
    return {
      message: keepCart
        ? "Hajde da krenemo ispočetka — korpa ostaje. Šta želite dalje?"
        : "Hajde da krenemo ispočetka — kako vam mogu pomoći?",
      quickReplies: chips,
      contextInjection: null,
    };
  }

  if (input.recovery.action === "offer_chips") {
    if (lang === "de") {
      return {
        message:
          "Damit es einfacher wird — wählen Sie eine Option, dann gehen wir gezielt weiter.",
        quickReplies: chips.slice(0, 4),
        contextInjection: null,
      };
    }
    if (lang === "en") {
      return {
        message:
          "To make this easier — pick an option and we'll move forward clearly.",
        quickReplies: chips.slice(0, 4),
        contextInjection: null,
      };
    }
    return {
      message:
        "Da se ne ponavljam — izaberite opciju pa idemo dalje konkretno.",
      quickReplies: chips.slice(0, 4),
      contextInjection: null,
    };
  }

  // rephrase / info_re_ask
  const guestAnswer = input.recovery.guestAnswer;
  if (guestAnswer) {
    if (lang === "de") {
      return {
        message: `Damit wir nicht wiederholen — Sie haben zuvor gesagt: „${guestAnswer}". Sollen wir darauf aufbauen?`,
        quickReplies: chips.slice(0, 3),
        contextInjection: guestAnswer,
      };
    }
    if (lang === "en") {
      return {
        message: `So we don't repeat — you mentioned earlier: "${guestAnswer}". Shall we continue from there?`,
        quickReplies: chips.slice(0, 3),
        contextInjection: guestAnswer,
      };
    }
    return {
      message: `Da se ne ponavljam — ranije ste rekli: „${guestAnswer}". Nastavljamo odatle?`,
      quickReplies: chips.slice(0, 3),
      contextInjection: guestAnswer,
    };
  }

  if (lang === "de") {
    return {
      message: "Kurz anders gefragt — wobei darf ich Ihnen konkret helfen?",
      quickReplies: chips.slice(0, 3),
      contextInjection: input.recovery.hint || null,
    };
  }
  if (lang === "en") {
    return {
      message: "Let me ask differently — what specifically can I help you with?",
      quickReplies: chips.slice(0, 3),
      contextInjection: input.recovery.hint || null,
    };
  }
  return {
    message: "Da se ne ponavljam — recite mi konkretno šta vam treba?",
    quickReplies: chips.slice(0, 3),
    contextInjection: input.recovery.hint || null,
  };
}

export { MAX_RECOVERY_ATTEMPTS };
