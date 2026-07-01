import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { ConversationQualityScore } from "@/lib/admin/denis-session-replay";

export type GuestIntentSlice = {
  intent: string;
  count: number;
  percent: number;
  label: string;
};

export type DenisInsightProblem = {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  ratePct: number;
  sampleGuestText: string | null;
};

export type DenisImprovementSuggestion = {
  id: string;
  priority: "high" | "medium" | "low";
  message: string;
  action: string;
};

export type WeeklyQualityPoint = {
  weekLabel: string;
  score: number;
  sessionCount: number;
};

export type UnknownIntentEdgeCase = {
  id: string;
  sessionId: string;
  guestText: string;
  denisResponse: string | null;
  capturedAt: string;
  reviewed: boolean;
};

export type DenisInsightsAggregate = {
  intentBreakdown: GuestIntentSlice[];
  problems: DenisInsightProblem[];
  suggestions: DenisImprovementSuggestion[];
  weeklyQuality: WeeklyQualityPoint[];
  edgeCases: UnknownIntentEdgeCase[];
  avgQualityScore: number;
};

const INTENT_LABELS: Record<string, string> = {
  ORDER: "Ordering",
  BROWSE: "Browsing",
  HANDOFF_PAY: "Paying",
  HANDOFF_WAITER: "Waiter handoff",
  STATUS: "Order status",
  CONFIRM: "Confirming",
  DECLINE: "Declining",
  SMALLTALK: "Small talk",
  UNKNOWN: "Unknown",
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function weekStartLabel(iso: string): string {
  const date = new Date(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function aggregateGuestIntents(
  events: DenisTimelineRow[]
): GuestIntentSlice[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const event of events) {
    if (event.event_type !== "intent.resolved") continue;
    const payload = asRecord(event.payload);
    const intent =
      typeof payload.intent === "string" ? payload.intent : "UNKNOWN";
    counts.set(intent, (counts.get(intent) ?? 0) + 1);
    total += 1;
  }

  if (total === 0) return [];

  return [...counts.entries()]
    .map(([intent, count]) => ({
      intent,
      count,
      percent: Math.round((count / total) * 1000) / 10,
      label: INTENT_LABELS[intent] ?? intent,
    }))
    .sort((a, b) => b.count - a.count);
}

export function detectDenisInsightProblems(input: {
  events: DenisTimelineRow[];
  sessionCount: number;
}): DenisInsightProblem[] {
  const problems: DenisInsightProblem[] = [];
  const totalTurns = input.events.filter(
    (event) => event.event_type === "intent.resolved"
  ).length;

  if (totalTurns === 0) return problems;

  const unknownEvents = input.events.filter((event) => {
    if (event.event_type !== "intent.resolved") return false;
    return asRecord(event.payload).intent === "UNKNOWN";
  });

  const payHandoffMisses = input.events.filter((event) => {
    if (event.event_type !== "perception.ingested") return false;
    const frame = asRecord(event.payload).frame as Record<string, unknown> | undefined;
    const text =
      typeof frame?.normalizedText === "string"
        ? frame.normalizedText.toLowerCase()
        : "";
    if (!text.includes("plat") && !text.includes("pay") && !text.includes("rechnung")) {
      return false;
    }
    const traceId = event.trace_id;
    const resolved = input.events.find(
      (row) =>
        row.trace_id === traceId &&
        row.event_type === "intent.resolved" &&
        asRecord(row.payload).intent === "UNKNOWN"
    );
    return Boolean(resolved);
  });

  if (unknownEvents.length > 0) {
    const rate = Math.round((unknownEvents.length / totalTurns) * 1000) / 10;
    const sample = unknownEvents[0];
    const guestText =
      sample?.trace_id != null
        ? (() => {
            const perception = input.events.find(
              (row) =>
                row.trace_id === sample.trace_id &&
                row.event_type === "perception.ingested"
            );
            const frame = perception?.payload
              ? (asRecord(perception.payload).frame as
                  | Record<string, unknown>
                  | undefined)
              : undefined;
            return typeof frame?.normalizedText === "string"
              ? frame.normalizedText
              : null;
          })()
        : null;

    problems.push({
      id: "unknown_intent_rate",
      severity: rate >= 10 ? "critical" : rate >= 5 ? "warning" : "info",
      message: `Denis does not understand ${rate}% of guest intents`,
      ratePct: rate,
      sampleGuestText: guestText,
    });
  }

  if (payHandoffMisses.length > 0) {
    const rate =
      Math.round((payHandoffMisses.length / totalTurns) * 1000) / 10;
    const frame = asRecord(payHandoffMisses[0]?.payload).frame as
      | Record<string, unknown>
      | undefined;
    problems.push({
      id: "pay_handoff_miss",
      severity: "warning",
      message: `Denis misses payment requests like "mogu li platiti" in ~${rate}% of cases`,
      ratePct: rate,
      sampleGuestText:
        typeof frame?.normalizedText === "string" ? frame.normalizedText : null,
    });
  }

  return problems;
}

export function generateDenisImprovementSuggestions(
  problems: DenisInsightProblem[]
): DenisImprovementSuggestion[] {
  const suggestions: DenisImprovementSuggestion[] = [];

  for (const problem of problems) {
    if (problem.id === "pay_handoff_miss") {
      suggestions.push({
        id: "add_pay_handoff_trigger",
        priority: "high",
        message: "Add 'platiti' / 'pay' phrases to HANDOFF_PAY trigger",
        action: "Update reflex/handoff patterns and add eval fixture",
      });
    }
    if (problem.id === "unknown_intent_rate" && problem.ratePct >= 5) {
      suggestions.push({
        id: "expand_unknown_eval",
        priority: problem.ratePct >= 10 ? "high" : "medium",
        message: "Review unknown intent edge cases and promote to eval suite",
        action: "Admin → Denis Insights → Edge cases → Add to eval",
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "maintain_quality",
      priority: "low",
      message: "Intent coverage looks healthy — monitor weekly quality trend",
      action: "No action required",
    });
  }

  return suggestions;
}

export function aggregateWeeklyQualityTrend(input: {
  sessions: Array<{
    createdAt: string;
    quality: ConversationQualityScore;
  }>;
}): WeeklyQualityPoint[] {
  const byWeek = new Map<string, { scoreSum: number; count: number }>();

  for (const session of input.sessions) {
    const key = weekStartLabel(session.createdAt);
    const bucket = byWeek.get(key) ?? { scoreSum: 0, count: 0 };
    bucket.scoreSum += session.quality.overall;
    bucket.count += 1;
    byWeek.set(key, bucket);
  }

  return [...byWeek.entries()]
    .map(([weekLabel, bucket]) => ({
      weekLabel,
      score: Math.round(bucket.scoreSum / bucket.count),
      sessionCount: bucket.count,
    }))
    .slice(-8);
}

export function collectUnknownIntentEdgeCases(input: {
  sessionId: string;
  events: DenisTimelineRow[];
}): UnknownIntentEdgeCase[] {
  const cases: UnknownIntentEdgeCase[] = [];
  let index = 0;

  for (const event of input.events) {
    if (event.event_type !== "intent.resolved") continue;
    const payload = asRecord(event.payload);
    if (payload.intent !== "UNKNOWN") continue;

    const traceId = event.trace_id;
    const perception = input.events.find(
      (row) =>
        row.trace_id === traceId && row.event_type === "perception.ingested"
    );
    const frame = perception?.payload
      ? (asRecord(perception.payload).frame as
          | Record<string, unknown>
          | undefined)
      : undefined;
    const guestText =
      typeof frame?.normalizedText === "string" ? frame.normalizedText : "";
    if (!guestText.trim()) continue;

    const narration = input.events.find(
      (row) =>
        row.trace_id === traceId &&
        (row.event_type === "narration.sent" ||
          row.event_type === "tell.committed")
    );
    const narrationPayload = narration?.payload
      ? asRecord(narration.payload)
      : {};

    cases.push({
      id: `${input.sessionId}:unknown:${index}`,
      sessionId: input.sessionId,
      guestText,
      denisResponse:
        typeof narrationPayload.message === "string"
          ? narrationPayload.message
          : null,
      capturedAt: event.created_at,
      reviewed: false,
    });
    index += 1;
  }

  return cases;
}

export function buildDenisInsightsAggregate(input: {
  events: DenisTimelineRow[];
  sessionCount: number;
  sessionQualities: Array<{
    createdAt: string;
    quality: ConversationQualityScore;
  }>;
  edgeCases: UnknownIntentEdgeCase[];
}): DenisInsightsAggregate {
  const intentBreakdown = aggregateGuestIntents(input.events);
  const problems = detectDenisInsightProblems({
    events: input.events,
    sessionCount: input.sessionCount,
  });
  const suggestions = generateDenisImprovementSuggestions(problems);
  const weeklyQuality = aggregateWeeklyQualityTrend({
    sessions: input.sessionQualities,
  });

  const avgQualityScore =
    input.sessionQualities.length > 0
      ? Math.round(
          input.sessionQualities.reduce(
            (sum, row) => sum + row.quality.overall,
            0
          ) / input.sessionQualities.length
        )
      : 0;

  return {
    intentBreakdown,
    problems,
    suggestions,
    weeklyQuality,
    edgeCases: input.edgeCases,
    avgQualityScore,
  };
}
