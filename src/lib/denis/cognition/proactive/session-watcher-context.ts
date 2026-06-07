import type { AiGuestOrder } from "@/lib/ai/order-context";
import { guestAskedForRecommendation } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  detectGuestLanguageFromTimeline,
  extractGuestContinuityState,
} from "@/lib/denis/cognition/conversation/guest-continuity";
import {
  extractDismissedNudges,
  extractProactiveDedupeKeys,
} from "@/lib/denis/loop/extract-dismissed-nudges";

const MS_MINUTE = 60_000;

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function guestTextFromTimeline(event: DenisTimelineRow): string | null {
  if (event.event_type === "signal.message") {
    const text =
      typeof asRecord(event.payload).text === "string"
        ? (asRecord(event.payload).text as string).trim()
        : "";
    return text || null;
  }

  if (event.event_type === "perception.ingested") {
    const frame = asRecord(event.payload).frame;
    if (!frame || typeof frame !== "object") return null;
    const text =
      typeof (frame as Record<string, unknown>).normalizedText === "string"
        ? ((frame as Record<string, unknown>).normalizedText as string).trim()
        : "";
    return text || null;
  }

  return null;
}

export type SessionWatcherContext = {
  sessionAgeSeconds: number;
  guestMessageCount: number;
  idleMinutes: number;
  guestAskedRecommendation: boolean;
  dismissedNudgeKeys: string[];
  emittedKeys: string[];
  recentGuestMessages: string[];
  waiterEscalated: boolean;
  browsingDeferredAt: string | null;
  browsingDeferCount: number;
  browseFollowUpEmitted: boolean;
  followUpRequestedAt: string | null;
  followUpDelaySeconds: number | null;
  guestLanguage: string | null;
};

export function buildSessionWatcherContext(input: {
  timeline: DenisTimelineRow[];
  orders: AiGuestOrder[];
  sessionOpenedAt: string;
  venueDefaultLanguage?: string;
  now?: number;
}): SessionWatcherContext {
  const now = input.now ?? Date.now();
  const openedAt = new Date(input.sessionOpenedAt).getTime();
  const sessionAgeSeconds = Math.max(0, Math.floor((now - openedAt) / 1000));

  const guestMessages: Array<{ text: string; at: string }> = [];
  let lastActivityMs = openedAt;
  let waiterEscalated = false;

  for (const event of input.timeline) {
    const createdAt = new Date(event.created_at).getTime();
    if (createdAt > lastActivityMs) {
      lastActivityMs = createdAt;
    }

    const guestText = guestTextFromTimeline(event);
    if (guestText) {
      guestMessages.push({ text: guestText, at: event.created_at });
      lastActivityMs = Math.max(lastActivityMs, createdAt);
    }

    if (
      event.event_type === "act.committed" ||
      event.event_type === "handoff.committed"
    ) {
      const payload = asRecord(event.payload);
      const skill = payload.skill ?? payload.kind;
      if (skill === "handoff.waiter" || payload.handoffKind === "waiter") {
        waiterEscalated = true;
      }
    }
  }

  for (const order of input.orders) {
    const createdAt = new Date(order.created_at).getTime();
    if (createdAt > lastActivityMs) {
      lastActivityMs = createdAt;
    }
    if (order.delivered_at) {
      const deliveredAt = new Date(order.delivered_at).getTime();
      if (deliveredAt > lastActivityMs) {
        lastActivityMs = deliveredAt;
      }
    }
  }

  const idleMinutes = (now - lastActivityMs) / MS_MINUTE;
  const recentGuestMessages = guestMessages.slice(-8).map((row) => row.text);
  const continuity = extractGuestContinuityState(input.timeline);

  return {
    sessionAgeSeconds,
    guestMessageCount: guestMessages.length,
    idleMinutes,
    guestAskedRecommendation: recentGuestMessages.some((message) =>
      guestAskedForRecommendation(message)
    ),
    dismissedNudgeKeys: extractDismissedNudges(input.timeline),
    emittedKeys: extractProactiveDedupeKeys(input.timeline),
    recentGuestMessages,
    waiterEscalated,
    browsingDeferredAt: continuity.lastDeferredAt,
    browsingDeferCount: continuity.deferCount,
    browseFollowUpEmitted: continuity.followUpEmitted,
    followUpRequestedAt: continuity.followUpRequestedAt,
    followUpDelaySeconds: continuity.followUpDelaySeconds,
    guestLanguage: detectGuestLanguageFromTimeline(
      input.timeline,
      input.venueDefaultLanguage ?? "sr"
    ),
  };
}
