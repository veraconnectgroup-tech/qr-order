import {
  foldMinimalBeliefs,
  type DenisMinimalBeliefs,
} from "@/lib/denis/kernel/fold-beliefs";
import { deriveGoalStack, topGoal } from "@/lib/denis/kernel/goal-stack";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type DebugBeliefRow = {
  key: string;
  value: string;
  confidence: number;
  source: string;
  evidenceSeq: number;
};

export type DebugTurnSummary = {
  traceId: string;
  guestText: string | null;
  intent: string | null;
  intentTier: string | null;
  topGoal: string | null;
  flowFrom: string | null;
  flowTo: string | null;
  narration: string | null;
  narrationTier: string | null;
  skills: Array<{ id: string; riskClass: string }>;
};

export type DenisSessionDebugGraph = {
  beliefs: DebugBeliefRow[];
  flow: {
    currentNodeId: string;
    previousNodeId: string | null;
    lastSignal: string | null;
    transitionCount: number;
  };
  goals: Array<{ type: string; priority: number }>;
  topGoal: string | null;
  turns: DebugTurnSummary[];
  timeline: Array<{
    seq: number;
    eventType: string;
    traceId: string | null;
    createdAt: string;
    payloadPreview: string;
  }>;
  meta: {
    eventCount: number;
    lastTraceId: string | null;
    hasCartConflict: boolean;
  };
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function flattenBeliefs(state: DenisMinimalBeliefs): DebugBeliefRow[] {
  const rows: DebugBeliefRow[] = [];

  const groups = [
    state.guest.language,
    state.guest.allergies,
    state.guest.lastUserIntent,
    state.table.sessionActive,
    state.table.hasOpenOrders,
    state.attention.lastMessage,
    state.attention.lastChannel,
  ];

  for (const belief of groups) {
    if (!belief) continue;
    rows.push({
      key: belief.key,
      value:
        typeof belief.value === "string"
          ? belief.value
          : JSON.stringify(belief.value),
      confidence: belief.confidence,
      source: belief.source,
      evidenceSeq: belief.evidenceEventSeq,
    });
  }

  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

function sessionHasCartConflict(events: DenisTimelineRow[]): boolean {
  return events.some((event) => {
    if (event.event_type !== "belief.revision") return false;
    const payload = asRecord(event.payload);
    const keys = payload.keys;
    return Array.isArray(keys) && keys.includes("cart.conflict");
  });
}

function buildTurnSummaries(events: DenisTimelineRow[]): DebugTurnSummary[] {
  const byTrace = new Map<string, DebugTurnSummary>();

  for (const event of events) {
    const traceId = event.trace_id?.trim();
    if (!traceId) continue;

    let turn = byTrace.get(traceId);
    if (!turn) {
      turn = {
        traceId,
        guestText: null,
        intent: null,
        intentTier: null,
        topGoal: null,
        flowFrom: null,
        flowTo: null,
        narration: null,
        narrationTier: null,
        skills: [],
      };
      byTrace.set(traceId, turn);
    }

    const payload = asRecord(event.payload);

    if (event.event_type === "perception.ingested") {
      const frame = payload.frame as Record<string, unknown> | undefined;
      const text =
        typeof frame?.normalizedText === "string" ? frame.normalizedText : null;
      if (text) turn.guestText = text;
    }

    if (event.event_type === "intent.resolved") {
      if (typeof payload.intent === "string") turn.intent = payload.intent;
      if (typeof payload.tier === "string") turn.intentTier = payload.tier;
    }

    if (event.event_type === "plan.created") {
      if (typeof payload.topGoal === "string") turn.topGoal = payload.topGoal;
      const actions = payload.actions;
      if (Array.isArray(actions)) {
        turn.skills = actions
          .map((action) => {
            if (!action || typeof action !== "object") return null;
            const row = action as Record<string, unknown>;
            const id = typeof row.skillId === "string" ? row.skillId : null;
            const riskClass =
              typeof row.riskClass === "string" ? row.riskClass : "R0";
            return id ? { id, riskClass } : null;
          })
          .filter((row): row is { id: string; riskClass: string } => row !== null);
      }
    }

    if (event.event_type === "flow.transitioned") {
      if (typeof payload.from === "string") turn.flowFrom = payload.from;
      if (typeof payload.to === "string") turn.flowTo = payload.to;
    }

    if (event.event_type === "narration.sent") {
      if (typeof payload.message === "string") turn.narration = payload.message;
      if (typeof payload.tier === "string") turn.narrationTier = payload.tier;
    }
  }

  return [...byTrace.values()];
}

function payloadPreview(payload: DenisTimelineRow["payload"]): string {
  const raw = JSON.stringify(payload);
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

/** M19 — replay beliefs, flow, goals, and per-trace turns from append-only timeline. */
export function buildSessionDebugGraph(
  events: DenisTimelineRow[],
  entryFlowNode: FlowNodeId = "welcome"
): DenisSessionDebugGraph {
  const beliefsState = foldMinimalBeliefs(events);
  const flow = foldFlowProjection(events, entryFlowNode);
  const cartConflict = sessionHasCartConflict(events);
  const goalStack = deriveGoalStack({
    flowNodeId: flow.currentNodeId,
    pendingSlot: null,
    cartConflict,
    foodUpsellAsked: flow.previousNodeId === "upsell_food",
    hasOpenOrders: beliefsState.table.hasOpenOrders?.value ?? false,
    lastIntent: beliefsState.guest.lastUserIntent?.value ?? null,
  });

  return {
    beliefs: flattenBeliefs(beliefsState),
    flow: {
      currentNodeId: flow.currentNodeId,
      previousNodeId: flow.previousNodeId,
      lastSignal: flow.lastSignal,
      transitionCount: flow.transitionCount,
    },
    goals: goalStack.map((goal) => ({
      type: goal.type,
      priority: goal.priority,
    })),
    topGoal: topGoal(goalStack)?.type ?? null,
    turns: buildTurnSummaries(events),
    timeline: events.map((event) => ({
      seq: event.seq,
      eventType: event.event_type,
      traceId: event.trace_id,
      createdAt: event.created_at,
      payloadPreview: payloadPreview(event.payload),
    })),
    meta: {
      eventCount: beliefsState.meta.eventCount,
      lastTraceId: beliefsState.meta.lastTraceId,
      hasCartConflict: cartConflict,
    },
  };
}
