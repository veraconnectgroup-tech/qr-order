import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { parseAllergenExclusionsFromText } from "@/lib/denis/kernel/safety/allergy-guard";
import type { BeliefDecayConfig } from "@/lib/denis/kernel/beliefs/belief-decay-config";
import { DEFAULT_BELIEF_DECAY_CONFIG } from "@/lib/denis/kernel/beliefs/belief-decay-config";
import {
  beliefCategoryForKey,
  computeDecayedConfidence,
  reinforceBeliefConfidence,
  type BeliefConflictLog,
  type BeliefHistoryEntry,
} from "@/lib/denis/kernel/beliefs/belief-confidence-core";

export type BeliefSource =
  | "guest_said"
  | "guest_tapped"
  | "system_inferred"
  | "order_core"
  | "menu_catalog"
  | "staff_ops"
  | "config";

export type Belief<T> = {
  key: string;
  value: T;
  confidence: number;
  source: BeliefSource;
  observedAt: string;
  observedAtMs: number;
  expiresAt: string | null;
  evidenceEventSeq: number;
  propagatedFrom?: string;
};

export type PropagatedMinimalBelief = {
  key: string;
  value: unknown;
  confidence: number;
  source: BeliefSource;
  propagatedFrom: string;
  observedAtMs: number;
};

export type DenisMinimalBeliefs = {
  guest: {
    language: Belief<string> | null;
    allergies: Belief<string[]> | null;
    lastUserIntent: Belief<GuestIntent> | null;
  };
  table: {
    sessionActive: Belief<boolean> | null;
    hasOpenOrders: Belief<boolean> | null;
  };
  attention: {
    lastMessage: Belief<string> | null;
    lastChannel: Belief<string> | null;
  };
  propagated: PropagatedMinimalBelief[];
  conflicts: BeliefConflictLog[];
  history: BeliefHistoryEntry[];
  meta: {
    lastEventSeq: number;
    lastTraceId: string | null;
    eventCount: number;
    foldedAtMs: number;
  };
};

export type FoldMinimalBeliefsOptions = {
  nowMs?: number;
  decayConfig?: BeliefDecayConfig;
};

export function emptyMinimalBeliefs(nowMs = Date.now()): DenisMinimalBeliefs {
  return {
    guest: {
      language: null,
      allergies: null,
      lastUserIntent: null,
    },
    table: {
      sessionActive: null,
      hasOpenOrders: null,
    },
    attention: {
      lastMessage: null,
      lastChannel: null,
    },
    propagated: [],
    conflicts: [],
    history: [],
    meta: {
      lastEventSeq: 0,
      lastTraceId: null,
      eventCount: 0,
      foldedAtMs: nowMs,
    },
  };
}

function belief<T>(
  key: string,
  value: T,
  source: BeliefSource,
  seq: number,
  observedAt: string,
  observedAtMs: number,
  confidence = 1.0,
  propagatedFrom?: string
): Belief<T> {
  return {
    key,
    value,
    confidence,
    source,
    observedAt,
    observedAtMs,
    expiresAt: null,
    evidenceEventSeq: seq,
    propagatedFrom,
  };
}

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function parseAtMs(at: string): number {
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? ms : Date.now();
}

function recordHistory(
  history: BeliefHistoryEntry[],
  entry: Omit<BeliefHistoryEntry, "atMs"> & { atMs?: number },
  atMs: number
) {
  history.push({
    atMs: entry.atMs ?? atMs,
    key: entry.key,
    value: entry.value,
    confidence: entry.confidence,
    source: entry.source,
    event: entry.event,
  });
}

function upsertBelief<T>(
  current: Belief<T> | null,
  next: Belief<T>,
  history: BeliefHistoryEntry[]
): Belief<T> {
  if (current && valuesEqual(current.value, next.value)) {
    const reinforced = {
      ...next,
      confidence: reinforceBeliefConfidence(current.confidence, true),
    };
    recordHistory(history, {
      key: reinforced.key,
      value: reinforced.value,
      confidence: reinforced.confidence,
      source: reinforced.source,
      event: "reinforced",
    }, next.observedAtMs);
    return reinforced;
  }

  recordHistory(history, {
    key: next.key,
    value: next.value,
    confidence: next.confidence,
    source: next.source,
    event: "observed",
  }, next.observedAtMs);

  return next;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyDecayToBelief<T>(
  row: Belief<T>,
  nowMs: number,
  config: BeliefDecayConfig,
  history: BeliefHistoryEntry[]
): Belief<T> {
  const category = beliefCategoryForKey(row.key);
  const decayed = computeDecayedConfidence(
    row.confidence,
    row.observedAtMs,
    nowMs,
    category,
    config
  );
  if (decayed === row.confidence) return row;
  recordHistory(history, {
    key: row.key,
    value: row.value,
    confidence: decayed,
    source: row.source,
    event: "decayed",
  }, nowMs);
  return { ...row, confidence: decayed };
}

function propagateMinimalBeliefs(
  state: DenisMinimalBeliefs,
  history: BeliefHistoryEntry[],
  nowMs: number
): PropagatedMinimalBelief[] {
  const propagated: PropagatedMinimalBelief[] = [];

  const allergies = state.guest.allergies;
  if (allergies?.value.includes("gluten")) {
    const row: PropagatedMinimalBelief = {
      key: "menu.filter",
      value: "no_gluten",
      confidence: allergies.confidence,
      source: "system_inferred",
      propagatedFrom: "guest.allergies",
      observedAtMs: allergies.observedAtMs,
    };
    propagated.push(row);
    recordHistory(history, {
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      source: row.source,
      event: "propagated",
    }, nowMs);
  }

  const intent = state.guest.lastUserIntent?.value;
  if (intent === "DONE" || intent === "HANDOFF_PAY") {
    const row: PropagatedMinimalBelief = {
      key: "venue.skip_upsell",
      value: true,
      confidence: state.guest.lastUserIntent!.confidence,
      source: "system_inferred",
      propagatedFrom: "guest.lastUserIntent",
      observedAtMs: state.guest.lastUserIntent!.observedAtMs,
    };
    propagated.push(row);
    recordHistory(history, {
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      source: row.source,
      event: "propagated",
    }, nowMs);
  }

  const language = state.guest.language?.value;
  if (language === "sr" || language === "hr") {
    const row: PropagatedMinimalBelief = {
      key: "conversation.ton",
      value: "casual",
      confidence: state.guest.language!.confidence,
      source: "system_inferred",
      propagatedFrom: "guest.language",
      observedAtMs: state.guest.language!.observedAtMs,
    };
    propagated.push(row);
    recordHistory(history, {
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      source: row.source,
      event: "propagated",
    }, nowMs);
  }

  return propagated;
}

function detectLanguageFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(serbisch|serbian|srpski|na srpskom|brate|bre|legendo)\b/i.test(lower)) {
    return "sr";
  }
  if (/\b(croatian|hrvatski|na hrvatskom)\b/i.test(lower)) {
    return "hr";
  }
  if (/[äöüßÄÖÜ]/.test(text) || /\b(bitte|danke|bier|rechnung)\b/i.test(lower)) {
    return "de";
  }
  if (/\b(please|thanks|hello|order)\b/i.test(lower)) {
    return "en";
  }
  if (
    /\b(jedn|molim|hvala|naru|poru|pivo|cola|zelim|zelim|brate|bre)\b/i.test(
      lower
    )
  ) {
    return "sr";
  }
  return null;
}

function detectIntentHint(
  text: string
): { intent: GuestIntent; confidence: number; explicit: boolean } | null {
  const lower = text.toLowerCase();
  if (/\b(daj|donesi|naruci|naruči|order)\b/i.test(lower)) {
    return { intent: "ORDER", confidence: 1.0, explicit: true };
  }
  if (/\b(mozda|maybe|vielleicht)\s+\w+/i.test(lower)) {
    return { intent: "BROWSE", confidence: 0.9, explicit: false };
  }
  if (/\b(salat|salad|burger|pizza)\b/i.test(lower)) {
    return { intent: "ORDER", confidence: 0.9, explicit: false };
  }
  return null;
}

/** M2 belief fold — decay, reinforcement, propagation (Prompt 91). */
export function foldMinimalBeliefs(
  events: DenisTimelineRow[],
  options: FoldMinimalBeliefsOptions = {}
): DenisMinimalBeliefs {
  const nowMs = options.nowMs ?? Date.now();
  const decayConfig = options.decayConfig ?? DEFAULT_BELIEF_DECAY_CONFIG;
  const state = emptyMinimalBeliefs(nowMs);
  const conflicts: BeliefConflictLog[] = [];

  for (const event of events) {
    const payload = asRecord(event.payload);
    const at = event.created_at;
    const atMs = parseAtMs(at);
    const seq = event.seq;

    state.meta.lastEventSeq = seq;
    state.meta.eventCount += 1;
    if (event.trace_id) {
      state.meta.lastTraceId = event.trace_id;
    }

    switch (event.event_type) {
      case "perception.ingested": {
        const frame = payload.frame as Record<string, unknown> | undefined;
        const text =
          typeof frame?.normalizedText === "string" ? frame.normalizedText : null;
        const channel =
          typeof frame?.channel === "string" ? frame.channel : null;
        if (text) {
          state.attention.lastMessage = upsertBelief(
            state.attention.lastMessage,
            belief(
              "attention.lastMessage",
              text,
              "guest_said",
              seq,
              at,
              atMs,
              1.0
            ),
            state.history
          );

          const allergens = parseAllergenExclusionsFromText(text);
          if (allergens.length > 0) {
            const labels = allergens.map(String);
            state.guest.allergies = upsertBelief(
              state.guest.allergies,
              belief(
                "guest.allergies",
                labels,
                "guest_said",
                seq,
                at,
                atMs,
                1.0
              ),
              state.history
            );
          }

          const lang = detectLanguageFromText(text);
          if (lang) {
            const isExplicit = /\b(serbisch|serbian|srpski|na srpskom|auf deutsch|in english)\b/i.test(
              text
            );
            state.guest.language = upsertBelief(
              state.guest.language,
              belief(
                "guest.language",
                lang,
                isExplicit ? "guest_said" : "system_inferred",
                seq,
                at,
                atMs,
                isExplicit ? 1.0 : 0.9
              ),
              state.history
            );
          }

          const intentHint = detectIntentHint(text);
          if (intentHint) {
            state.guest.lastUserIntent = upsertBelief(
              state.guest.lastUserIntent,
              belief(
                "guest.lastUserIntent",
                intentHint.intent,
                intentHint.explicit ? "guest_said" : "system_inferred",
                seq,
                at,
                atMs,
                intentHint.confidence
              ),
              state.history
            );
          }
        }
        if (channel) {
          state.attention.lastChannel = upsertBelief(
            state.attention.lastChannel,
            belief(
              "attention.lastChannel",
              channel,
              "guest_tapped",
              seq,
              at,
              atMs
            ),
            state.history
          );
        }
        state.table.sessionActive = upsertBelief(
          state.table.sessionActive,
          belief("table.sessionActive", true, "system_inferred", seq, at, atMs, 0.9),
          state.history
        );
        break;
      }
      case "intent.resolved": {
        const intent = payload.intent as GuestIntent | undefined;
        if (intent) {
          state.guest.lastUserIntent = upsertBelief(
            state.guest.lastUserIntent,
            belief(
              "guest.lastUserIntent",
              intent,
              "system_inferred",
              seq,
              at,
              atMs,
              payload.tier === "T0" ? 1.0 : 0.9
            ),
            state.history
          );
        }
        break;
      }
      case "order.command.ack": {
        state.table.hasOpenOrders = upsertBelief(
          state.table.hasOpenOrders,
          belief("table.hasOpenOrders", true, "order_core", seq, at, atMs, 1.0),
          state.history
        );
        if (state.guest.lastUserIntent) {
          const reinforced = {
            ...state.guest.lastUserIntent,
            confidence: 1.0,
            source: "order_core" as BeliefSource,
            observedAt: at,
            observedAtMs: atMs,
            evidenceEventSeq: seq,
          };
          state.guest.lastUserIntent = upsertBelief(
            state.guest.lastUserIntent,
            reinforced,
            state.history
          );
        }
        break;
      }
      default:
        break;
    }
  }

  state.meta.foldedAtMs = nowMs;

  const decayGuest = {
    language: state.guest.language
      ? applyDecayToBelief(state.guest.language, nowMs, decayConfig, state.history)
      : null,
    allergies: state.guest.allergies
      ? applyDecayToBelief(state.guest.allergies, nowMs, decayConfig, state.history)
      : null,
    lastUserIntent: state.guest.lastUserIntent
      ? applyDecayToBelief(
          state.guest.lastUserIntent,
          nowMs,
          decayConfig,
          state.history
        )
      : null,
  };
  state.guest = decayGuest;

  state.propagated = propagateMinimalBeliefs(state, state.history, nowMs);
  state.conflicts = conflicts;

  return state;
}

export function replayMinimalBeliefs(
  events: DenisTimelineRow[],
  options?: FoldMinimalBeliefsOptions
): DenisMinimalBeliefs {
  return foldMinimalBeliefs(events, options);
}

/** Confidence color for debug viz — green (1.0) → red (0.5). */
export function beliefConfidenceColor(confidence: number): string {
  const clamped = Math.max(0.5, Math.min(1, confidence));
  const ratio = (1 - clamped) / 0.5;
  const green = Math.round(34 + ratio * (220 - 34));
  const red = Math.round(197 + ratio * (38 - 197));
  return `rgb(${red}, ${green}, 80)`;
}
