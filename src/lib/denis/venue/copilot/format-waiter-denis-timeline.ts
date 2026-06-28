import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { WaiterDenisTimelineEntry } from "@/lib/denis/venue/copilot/waiter-copilot-types";

/** Guest-facing Denis lines for waiter table session view. */
export function formatWaiterDenisTimeline(
  timeline: DenisTimelineRow[]
): WaiterDenisTimelineEntry[] {
  const entries: WaiterDenisTimelineEntry[] = [];

  for (const row of timeline) {
    const payload = row.payload;
    if (payload.type === "narration.sent" || payload.type === "tell.committed") {
      const message = payload.message?.trim();
      if (!message) continue;
      entries.push({
        at: row.created_at,
        message,
        tier: payload.tier ?? null,
      });
    }
  }

  return entries.slice(-20);
}
