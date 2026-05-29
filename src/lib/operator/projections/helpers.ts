import type { SessionOutcome } from "@/lib/operator/types";

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
