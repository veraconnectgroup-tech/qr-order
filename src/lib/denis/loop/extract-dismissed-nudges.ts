import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Fold dismissed proactive nudge keys from timeline events. */
export function extractDismissedNudges(events: DenisTimelineRow[]): string[] {
  const keys = new Set<string>();

  for (const event of events) {
    if (event.event_type !== "realtime.ingested") continue;
    const payload = asRecord(event.payload);
    if (payload.type !== "realtime.ingested") continue;
    const source = payload.source;
    if (source !== "telemetry.scroll" && source !== "system.proactive_tick") {
      continue;
    }
    const inner = payload.payload;
    if (!inner || typeof inner !== "object") continue;
    const dismissed = (inner as Record<string, unknown>).dismissedNudgeKeys;
    if (!Array.isArray(dismissed)) continue;
    for (const key of dismissed) {
      if (typeof key === "string" && key.trim()) {
        keys.add(key.trim());
      }
    }
  }

  return [...keys];
}

/** Already-emitted proactive kinds — one browse nudge per session, etc. */
export function extractProactiveDedupeKeys(events: DenisTimelineRow[]): string[] {
  const keys = new Set<string>();

  for (const event of events) {
    if (event.event_type !== "proactive.emitted") continue;
    const payload = asRecord(event.payload);
    const kind = payload.kind;
    if (typeof kind !== "string" || !kind.trim()) continue;
    keys.add(kind.trim());
    const orderId = payload.orderId;
    if (typeof orderId === "string" && orderId.trim()) {
      keys.add(`${kind.trim()}:${orderId.trim()}`);
    }
  }

  return [...keys];
}
