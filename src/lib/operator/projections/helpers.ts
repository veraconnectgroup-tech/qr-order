import type {
  OperatorBeliefsSummary,
  OperatorSessionMetrics,
  SessionOutcome,
} from "@/lib/operator/types";

type MessageRow = { role: string; content: string };

export function countUserMessages(messages: MessageRow[]): number {
  return messages.filter((row) => row.role === "user").length;
}

export function redactTranscript(
  messages: MessageRow[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
}

export function topLanguagesFromSessions(
  rows: Array<{ language: string | null }>
): Array<{ lang: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const lang = row.language?.trim() || "unknown";
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => ({ lang, count }));
}

export function computeConversionRate(
  sessionsCount: number,
  sessionsWithOrder: number
): number {
  if (sessionsCount <= 0) return 0;
  return Math.round((sessionsWithOrder / sessionsCount) * 1000) / 1000;
}

export function computeLlmInvocationRate(input: {
  sessionsWithActivity: number;
  sessionsWithLlm: number;
}): number {
  if (input.sessionsWithActivity <= 0) return 0;
  return (
    Math.round((input.sessionsWithLlm / input.sessionsWithActivity) * 1000) /
    1000
  );
}

export function resolveSessionOutcome(input: {
  status: string;
  ordersCount: number;
  handoffCount: number;
}): SessionOutcome {
  if (input.status === "active") return "active";
  if (input.ordersCount > 0) return "ordered";
  if (input.handoffCount > 0) return "handoff";
  return "abandoned";
}

export function extractIntentsFromTimeline(
  events: Array<{ event_type: string; payload: unknown }>
): string[] {
  const intents = new Set<string>();
  for (const event of events) {
    if (event.event_type !== "intent.resolved") continue;
    const payload = event.payload as { intent?: string } | null;
    if (payload?.intent) intents.add(payload.intent);
  }
  return [...intents];
}

export function countEscalationsFromTimeline(
  events: Array<{ event_type: string; payload: unknown }>
): number {
  let count = 0;
  for (const event of events) {
    if (event.event_type !== "intent.resolved") continue;
    const payload = event.payload as { intent?: string } | null;
    if (
      payload?.intent === "HANDOFF_WAITER" ||
      payload?.intent === "HANDOFF_PAY"
    ) {
      count += 1;
    }
  }
  return count;
}

export function decimalToCents(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function computeAvgCheckCents(
  revenueCents: number,
  ordersCount: number
): number {
  if (ordersCount <= 0) return 0;
  return Math.round(revenueCents / ordersCount);
}

export function computeTipRate(
  ordersWithTip: number,
  paidOrders: number
): number | undefined {
  if (paidOrders <= 0) return undefined;
  return Math.round((ordersWithTip / paidOrders) * 1000) / 1000;
}

export function computeWaiterGapRate(input: {
  sessionsWithActivity: number;
  sessionsWithGap: number;
}): number {
  if (input.sessionsWithActivity <= 0) return 0;
  return (
    Math.round((input.sessionsWithGap / input.sessionsWithActivity) * 1000) /
    1000
  );
}

function sessionHadWaiterGap(
  events: Array<{ event_type: string; payload: unknown }>
): boolean {
  for (const event of events) {
    if (event.event_type !== "mind.beliefs_compiled") continue;
    const payload = event.payload as {
      summary?: Record<string, unknown>;
    } | null;
    const gapCount = payload?.summary?.["waiter.gap_count"];
    if (typeof gapCount === "number" && gapCount > 0) return true;
  }

  for (const event of events) {
    if (event.event_type !== "mind.turn_profile") continue;
    const payload = event.payload as { planReason?: string } | null;
    if (payload?.planReason === "waiter.gap_blocks_confirm") return true;
  }

  return false;
}

export function countSessionsWithWaiterGap(
  events: Array<{ event_type: string; payload: unknown; ai_session_id?: string }>
): number {
  const bySession = new Map<string, Array<{ event_type: string; payload: unknown }>>();

  for (const event of events) {
    const sessionId = event.ai_session_id;
    if (!sessionId) continue;
    const bucket = bySession.get(sessionId) ?? [];
    bucket.push(event);
    bySession.set(sessionId, bucket);
  }

  let count = 0;
  for (const sessionEvents of bySession.values()) {
    if (sessionHadWaiterGap(sessionEvents)) count += 1;
  }
  return count;
}

export function aggregateSessionMetricsFromTimeline(
  events: Array<{ event_type: string; payload: unknown }>
): OperatorSessionMetrics {
  const profiles = events.filter((row) => row.event_type === "mind.turn_profile");
  const turnCount = profiles.length;
  if (!turnCount) {
    return {
      turnCount: 0,
      llmTurnCount: 0,
      llmInvocationRate: 0,
      gapTurnCount: 0,
      gapRate: 0,
    };
  }

  let llmTurnCount = 0;
  let gapTurnCount = 0;
  for (const row of profiles) {
    const payload = row.payload as {
      llmUsed?: boolean;
      planReason?: string;
    } | null;
    if (payload?.llmUsed === true) llmTurnCount += 1;
    if (payload?.planReason === "waiter.gap_blocks_confirm") gapTurnCount += 1;
  }

  return {
    turnCount,
    llmTurnCount,
    llmInvocationRate:
      Math.round((llmTurnCount / turnCount) * 1000) / 1000,
    gapTurnCount,
    gapRate: Math.round((gapTurnCount / turnCount) * 1000) / 1000,
  };
}

export function extractLatestBeliefsSummary(
  events: Array<{
    event_type: string;
    payload: unknown;
    created_at?: string;
  }>
): OperatorBeliefsSummary | null {
  let latest: OperatorBeliefsSummary | null = null;

  for (const event of events) {
    if (event.event_type !== "mind.beliefs_compiled") continue;
    const payload = event.payload as {
      beliefsHash?: string;
      beliefCount?: number;
      summary?: Record<string, unknown>;
    } | null;
    if (!payload?.beliefsHash) continue;

    latest = {
      beliefsHash: payload.beliefsHash,
      beliefCount: payload.beliefCount ?? 0,
      summary: payload.summary ?? {},
      compiledAt: event.created_at ?? null,
    };
  }

  return latest;
}
