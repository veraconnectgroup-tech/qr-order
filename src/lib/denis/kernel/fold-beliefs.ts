import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

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
  confidence: 1.0 | 0.9 | 0.7 | 0.5;
  source: BeliefSource;
  observedAt: string;
  expiresAt: string | null;
  evidenceEventSeq: number;
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
  meta: {
    lastEventSeq: number;
    lastTraceId: string | null;
    eventCount: number;
  };
};

export function emptyMinimalBeliefs(): DenisMinimalBeliefs {
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
    meta: {
      lastEventSeq: 0,
      lastTraceId: null,
      eventCount: 0,
    },
  };
}

function belief<T>(
  key: string,
  value: T,
  source: BeliefSource,
  seq: number,
  observedAt: string,
  confidence: Belief<T>["confidence"] = 1.0
): Belief<T> {
  return {
    key,
    value,
    confidence,
    source,
    observedAt,
    expiresAt: null,
    evidenceEventSeq: seq,
  };
}

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** M2 belief fold — extends in M3+ with full ADR-004 belief engine. */
export function foldMinimalBeliefs(
  events: DenisTimelineRow[]
): DenisMinimalBeliefs {
  let state = emptyMinimalBeliefs();

  for (const event of events) {
    const payload = asRecord(event.payload);
    const at = event.created_at;
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
          state.attention.lastMessage = belief(
            "attention.lastMessage",
            text,
            "guest_said",
            seq,
            at
          );
        }
        if (channel) {
          state.attention.lastChannel = belief(
            "attention.lastChannel",
            channel,
            "guest_tapped",
            seq,
            at
          );
        }
        state.table.sessionActive = belief(
          "table.sessionActive",
          true,
          "system_inferred",
          seq,
          at
        );
        break;
      }
      case "intent.resolved": {
        const intent = payload.intent as GuestIntent | undefined;
        if (intent) {
          state.guest.lastUserIntent = belief(
            "guest.lastUserIntent",
            intent,
            "system_inferred",
            seq,
            at,
            payload.tier === "T0" ? 1.0 : 0.9
          );
        }
        break;
      }
      case "order.command.ack": {
        state.table.hasOpenOrders = belief(
          "table.hasOpenOrders",
          true,
          "order_core",
          seq,
          at
        );
        break;
      }
      default:
        break;
    }
  }

  return state;
}

export function replayMinimalBeliefs(
  events: DenisTimelineRow[]
): DenisMinimalBeliefs {
  return foldMinimalBeliefs(events);
}
