import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type ServiceRecoveryTimelineEvent = {
  kind: "opened" | "resolved";
  at: string;
  tableId?: string | null;
  triggers?: string[];
  gesture?: string | null;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function parseServiceRecoveryTimelineEvents(
  timeline: DenisTimelineRow[]
): ServiceRecoveryTimelineEvent[] {
  const out: ServiceRecoveryTimelineEvent[] = [];
  for (const row of timeline) {
    if (row.event_type === "service.recovery.opened") {
      const payload = asRecord(row.payload);
      out.push({
        kind: "opened",
        at: row.created_at,
        tableId:
          typeof payload.tableId === "string" ? payload.tableId : null,
        triggers: Array.isArray(payload.triggers)
          ? payload.triggers.map(String)
          : undefined,
        gesture:
          typeof payload.gesture === "string" ? payload.gesture : null,
      });
      continue;
    }
    if (row.event_type === "service.recovery.resolved") {
      const resolvedPayload = asRecord(row.payload);
      out.push({
        kind: "resolved",
        at: row.created_at,
        tableId:
          typeof resolvedPayload.tableId === "string"
            ? resolvedPayload.tableId
            : null,
      });
    }
  }
  return out;
}

/** Active recovery blocks review prompts (S12). */
export function hasActiveServiceRecovery(input: {
  timeline: DenisTimelineRow[];
  nowMs?: number;
  blockMinutes: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.blockMinutes * 60_000;
  const events = parseServiceRecoveryTimelineEvents(input.timeline);
  let lastOpenedAt: number | null = null;

  for (const event of events) {
    const at = Date.parse(event.at);
    if (!Number.isFinite(at)) continue;
    if (event.kind === "opened") {
      lastOpenedAt = at;
    }
    if (event.kind === "resolved" && lastOpenedAt != null && at >= lastOpenedAt) {
      lastOpenedAt = null;
    }
  }

  if (lastOpenedAt == null) return false;
  return nowMs - lastOpenedAt <= windowMs;
}
