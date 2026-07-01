import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import { isGuestDeclineMessage } from "@/lib/denis/cognition/tde/semantic-intent-router";
import { guestAskedForRecommendation } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function isBrowseEvent(row: DenisTimelineRow): BrowseEvent | null {
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { type?: string }).type !== "perception.ingested") return null;
  const frame = (payload as { frame?: { channel?: string } }).frame;
  if (frame?.channel !== "telemetry.browse") return null;
  const event = (payload as { browseEvent?: BrowseEvent }).browseEvent;
  if (!event || typeof event !== "object") return null;
  return event;
}

/** One timeline pass — canonical guest signals for posture fold (ADR-038 Val A). */
export function foldGuestSignals(input: {
  timeline: DenisTimelineRow[];
  dismissedNudgeKeys: string[];
}): GuestSignalSpine {
  const guestMessages: GuestSignalSpine["guestMessages"] = [];
  const declineSignals: GuestSignalSpine["declineSignals"] = [];
  const churnMap = new Map<string, GuestSignalSpine["browseChurn"][0]>();
  const proactivePairs: GuestSignalSpine["proactivePairs"] = [];
  const emittedProactiveKeys = new Set<string>();
  const actionTimestamps: number[] = [];
  let recommendationAsked = false;
  let guestInitiatedBeforeDenis = false;
  let denisOutboundSeen = false;
  let pendingProactive: { emittedAt: number } | null = null;

  for (const row of input.timeline) {
    const at = new Date(row.created_at).getTime();

    if (row.event_type === "realtime.ingested") {
      const inner = asRecord(row.payload).payload;
      if (inner && typeof inner === "object") {
        const dismissed = (inner as { dismissedNudgeKeys?: unknown }).dismissedNudgeKeys;
        if (Array.isArray(dismissed)) {
          for (const key of dismissed) {
            if (typeof key === "string" && key.trim()) {
              declineSignals.push({ kind: "dismiss", at, nudgeKey: key.trim() });
            }
          }
        }
      }
    }

    const guestText = guestTextFromTimeline(row);
    if (guestText) {
      guestMessages.push({ text: guestText, at });
      actionTimestamps.push(at);

      if (!denisOutboundSeen) {
        guestInitiatedBeforeDenis = true;
      }

      if (isGuestDeclineMessage(guestText)) {
        declineSignals.push({ kind: "explicit", at });
      }

      if (guestAskedForRecommendation(guestText)) {
        recommendationAsked = true;
      }

      if (pendingProactive) {
        proactivePairs.push({ emittedAt: pendingProactive.emittedAt, guestReplied: true });
        pendingProactive = null;
      }
    }

    const browseEvent = isBrowseEvent(row);
    if (browseEvent?.productId) {
      if (browseEvent.action === "add_to_cart" || browseEvent.action === "remove_from_cart") {
        actionTimestamps.push(at);
        const existing = churnMap.get(browseEvent.productId) ?? {
          productId: browseEvent.productId,
          adds: 0,
          removes: 0,
        };
        if (browseEvent.action === "add_to_cart") existing.adds++;
        else existing.removes++;
        churnMap.set(browseEvent.productId, existing);
      }
    }

    if (row.event_type === "proactive.emitted") {
      denisOutboundSeen = true;
      const payload = asRecord(row.payload);
      const kind = payload.kind;
      if (typeof kind === "string" && kind.trim()) {
        emittedProactiveKeys.add(kind.trim());
        const orderId = payload.orderId;
        if (typeof orderId === "string" && orderId.trim()) {
          emittedProactiveKeys.add(`${kind.trim()}:${orderId.trim()}`);
        }
      }
      pendingProactive = { emittedAt: at };
    }

    if (row.event_type === "tell.committed") {
      denisOutboundSeen = true;
    }
  }

  if (pendingProactive) {
    proactivePairs.push({ emittedAt: pendingProactive.emittedAt, guestReplied: false });
  }

  for (const key of input.dismissedNudgeKeys) {
    if (!declineSignals.some((signal) => signal.kind === "dismiss" && signal.nudgeKey === key)) {
      const lastAt =
        guestMessages[guestMessages.length - 1]?.at ??
        (input.timeline.length > 0
          ? new Date(input.timeline[input.timeline.length - 1]!.created_at).getTime()
          : 0);
      declineSignals.push({ kind: "dismiss", at: lastAt, nudgeKey: key });
    }
  }

  const browseChurn = [...churnMap.values()];
  const maxProductCartChurn = browseChurn.reduce(
    (max, entry) => Math.max(max, entry.adds + entry.removes),
    0
  );

  return {
    guestMessages,
    declineSignals,
    browseChurn,
    maxProductCartChurn,
    proactivePairs,
    emittedProactiveKeys: [...emittedProactiveKeys],
    recommendationAsked,
    guestInitiatedBeforeDenis,
    actionTimestamps,
  };
}
