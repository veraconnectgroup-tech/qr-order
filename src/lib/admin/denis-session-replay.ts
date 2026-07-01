import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { TurnTrace } from "@/lib/denis/runtime/turn-trace";

export type ReplayTimelineEvent = {
  seq: number;
  eventType: string;
  traceId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
  category: "signal" | "view" | "act" | "other";
};

export type TurnExplanation = {
  traceId: string;
  guestText: string | null;
  intent: string | null;
  intentTier: string | null;
  planKind: string | null;
  planReason: string | null;
  narration: string | null;
  narrationTier: string | null;
  llmUsed: boolean | null;
  situationContext: string | null;
  llmPromptHint: string | null;
  response: string | null;
  durationMs: number | null;
};

export type MentalModelTurnSnapshot = {
  traceId: string | null;
  seq: number;
  intent: string | null;
  pace: string | null;
  receptiveness: string | null;
  frustration: string | null;
  changes: string[];
};

export type ProactiveDecisionRow = {
  seq: number;
  createdAt: string;
  candidateKind: string;
  ranked: boolean;
  emitted: boolean;
  allow: boolean | null;
  reason: string | null;
  message: string | null;
};

export type DenisSessionReplay = {
  timeline: ReplayTimelineEvent[];
  turnExplanations: TurnExplanation[];
  mentalModelEvolution: MentalModelTurnSnapshot[];
  proactiveDecisions: ProactiveDecisionRow[];
  qualityScore: ConversationQualityScore | null;
};

export type ConversationQualityScore = {
  overall: number;
  accurate: number;
  fast: number;
  pleasant: number;
  summary: string;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function categorizeEvent(eventType: string): ReplayTimelineEvent["category"] {
  if (
    eventType.startsWith("signal.") ||
    eventType.startsWith("perception.") ||
    eventType.startsWith("intent.") ||
    eventType.startsWith("realtime.")
  ) {
    return "signal";
  }
  if (
    eventType.startsWith("flow.") ||
    eventType.startsWith("mind.") ||
    eventType.startsWith("mental_model.") ||
    eventType.startsWith("belief.")
  ) {
    return "view";
  }
  if (
    eventType.startsWith("plan.") ||
    eventType.startsWith("draft.") ||
    eventType.startsWith("order.") ||
    eventType.startsWith("narration.") ||
    eventType.startsWith("tell.") ||
    eventType.startsWith("proactive.") ||
    eventType.startsWith("offer.") ||
    eventType.startsWith("policy.")
  ) {
    return "act";
  }
  return "other";
}

export function buildReplayTimeline(
  events: DenisTimelineRow[]
): ReplayTimelineEvent[] {
  return events.map((event) => ({
    seq: event.seq,
    eventType: event.event_type,
    traceId: event.trace_id,
    createdAt: event.created_at,
    payload: asRecord(event.payload),
    category: categorizeEvent(event.event_type),
  }));
}

export function buildTurnExplanations(
  events: DenisTimelineRow[],
  traces: TurnTrace[]
): TurnExplanation[] {
  const traceById = new Map(traces.map((trace) => [trace.traceId, trace]));
  const byTrace = new Map<string, TurnExplanation>();

  for (const event of events) {
    const traceId = event.trace_id?.trim();
    if (!traceId) continue;

    let turn = byTrace.get(traceId);
    if (!turn) {
      const trace = traceById.get(traceId);
      turn = {
        traceId,
        guestText: trace?.guestInput ?? null,
        intent: null,
        intentTier: null,
        planKind: null,
        planReason: null,
        narration: trace?.denisResponse ?? null,
        narrationTier: null,
        llmUsed: trace?.phases.perceive.llmUsed ?? null,
        situationContext: null,
        llmPromptHint: trace?.phases.perceive.llmUsed
          ? `Tier ${trace.phases.plan.tier} · ${trace.phases.plan.planKind}`
          : null,
        response: trace?.denisResponse ?? null,
        durationMs: trace?.totalDurationMs ?? null,
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

    if (event.event_type === "mind.turn_profile") {
      if (typeof payload.planKind === "string") turn.planKind = payload.planKind;
      if (typeof payload.planReason === "string") {
        turn.planReason = payload.planReason;
      }
      if (payload.llmUsed === true) turn.llmUsed = true;
    }

    if (event.event_type === "plan.created") {
      if (typeof payload.topGoal === "string") {
        turn.situationContext = `Goal: ${payload.topGoal}`;
      }
    }

    if (event.event_type === "mind.beliefs_compiled") {
      const summary = payload.summary;
      if (summary && typeof summary === "object") {
        turn.situationContext = JSON.stringify(summary, null, 2);
      }
    }

    if (
      event.event_type === "narration.sent" ||
      event.event_type === "tell.committed"
    ) {
      if (typeof payload.message === "string") {
        turn.narration = payload.message;
        turn.response = payload.message;
      }
      if (typeof payload.tier === "string") turn.narrationTier = payload.tier;
    }
  }

  return [...byTrace.values()];
}

export function buildMentalModelEvolution(
  events: DenisTimelineRow[]
): MentalModelTurnSnapshot[] {
  const snapshots: MentalModelTurnSnapshot[] = [];

  for (const event of events) {
    const payload = asRecord(event.payload);

    if (event.event_type === "mental_model.updated") {
      const model = payload.model as Record<string, unknown> | undefined;
      snapshots.push({
        traceId: event.trace_id,
        seq: event.seq,
        intent:
          typeof model?.predictedNeed === "string"
            ? model.predictedNeed
            : null,
        pace: typeof model?.pace === "string" ? model.pace : null,
        receptiveness:
          typeof model?.receptiveness === "string"
            ? model.receptiveness
            : null,
        frustration:
          typeof (model?.affect as Record<string, unknown> | undefined)
            ?.frustration === "object"
            ? String(
                (
                  (model?.affect as Record<string, unknown>).frustration as {
                    level?: string;
                  }
                )?.level ?? ""
              ) || null
            : null,
        changes: [],
      });
    }

    if (event.event_type === "mental_model.diff") {
      const changes = payload.changes;
      const last = snapshots[snapshots.length - 1];
      if (last && Array.isArray(changes)) {
        last.changes = changes
          .map((change) => {
            if (!change || typeof change !== "object") return null;
            const row = change as Record<string, unknown>;
            return `${row.field}: ${row.from} → ${row.to}`;
          })
          .filter((row): row is string => Boolean(row));
      }
    }
  }

  return snapshots;
}

export function buildProactiveDecisions(
  events: DenisTimelineRow[]
): ProactiveDecisionRow[] {
  const emittedKinds = new Set<string>();
  const rows: ProactiveDecisionRow[] = [];

  for (const event of events) {
    const payload = asRecord(event.payload);

    if (event.event_type === "mental_model.gate") {
      rows.push({
        seq: event.seq,
        createdAt: event.created_at,
        candidateKind:
          typeof payload.candidateKind === "string"
            ? payload.candidateKind
            : "unknown",
        ranked: true,
        emitted: false,
        allow: payload.allow === true,
        reason:
          typeof payload.reason === "string" ? payload.reason : null,
        message: null,
      });
    }

    if (event.event_type === "proactive.emitted") {
      const kind =
        typeof payload.kind === "string" ? payload.kind : "unknown";
      emittedKinds.add(kind);
      rows.push({
        seq: event.seq,
        createdAt: event.created_at,
        candidateKind: kind,
        ranked: true,
        emitted: true,
        allow: true,
        reason:
          typeof payload.policyReason === "string"
            ? payload.policyReason
            : null,
        message:
          typeof payload.message === "string" ? payload.message : null,
      });
    }
  }

  return rows.map((row) =>
    row.emitted ? row : { ...row, emitted: emittedKinds.has(row.candidateKind) }
  );
}

export function computeSessionConversationQuality(input: {
  events: DenisTimelineRow[];
  traces: TurnTrace[];
}): ConversationQualityScore {
  const unknownCount = input.events.filter((event) => {
    if (event.event_type !== "intent.resolved") return false;
    const payload = asRecord(event.payload);
    return payload.intent === "UNKNOWN";
  }).length;

  const handoffCount = input.events.filter((event) => {
    if (event.event_type !== "intent.resolved") return false;
    const payload = asRecord(event.payload);
    return (
      payload.intent === "HANDOFF_WAITER" || payload.intent === "HANDOFF_PAY"
    );
  }).length;

  const turnCount = Math.max(1, input.traces.length);
  const avgMs =
    input.traces.length > 0
      ? input.traces.reduce((sum, trace) => sum + trace.totalDurationMs, 0) /
        input.traces.length
      : 0;

  const accurate = Math.max(
    0,
    Math.min(100, 100 - unknownCount * 15 - handoffCount * 5)
  );
  const fast = Math.max(0, Math.min(100, 100 - Math.max(0, avgMs - 2000) / 50));
  const pleasant = Math.max(
    0,
    Math.min(100, 100 - (handoffCount / turnCount) * 40)
  );
  const overall = Math.round((accurate + fast + pleasant) / 3);

  let summary = "Solid session — Denis stayed accurate and responsive.";
  if (unknownCount > 0) {
    summary = `Denis missed ${unknownCount} guest intent(s) — review edge cases.`;
  } else if (avgMs > 4000) {
    summary = "Responses were slow — check LLM tier routing.";
  } else if (handoffCount > 0) {
    summary = "Guest requested handoff — verify Denis coverage for those intents.";
  }

  return {
    overall,
    accurate: Math.round(accurate),
    fast: Math.round(fast),
    pleasant: Math.round(pleasant),
    summary,
  };
}

export function buildDenisSessionReplay(input: {
  events: DenisTimelineRow[];
  traces: TurnTrace[];
}): DenisSessionReplay {
  return {
    timeline: buildReplayTimeline(input.events),
    turnExplanations: buildTurnExplanations(input.events, input.traces),
    mentalModelEvolution: buildMentalModelEvolution(input.events),
    proactiveDecisions: buildProactiveDecisions(input.events),
    qualityScore: computeSessionConversationQuality(input),
  };
}
