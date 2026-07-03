/**
 * Phase 4 — proactive empathy before guest complaint (kitchen delay + engagement drop).
 */
import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import { isGuestServiceComplaintMessage } from "@/lib/denis/cognition/recovery/detect-service-recovery";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type PredictiveRecoverySignal =
  | "kitchen_delay_proactive"
  | "engagement_drop";

export type PredictiveRecoveryResult = {
  signals: PredictiveRecoverySignal[];
  kitchenWaitMinutes: number | null;
  shouldBoostEmpathy: boolean;
};

const KITCHEN_WAIT_STATUSES: readonly string[] = [
  "pending",
  "accepted",
  "preparing",
];

const SHORT_REPLY_PATTERN =
  /^(ok|okej|okay|da|ne|mhm+|hm+|aha|u redu|fine|ja|yo|👍|🙂|k|n)$/i;

const DEFAULT_PREDICTIVE_KITCHEN_MINUTES = 20;

export function extractGuestMessagesFromTimeline(
  timeline: DenisTimelineRow[]
): string[] {
  const messages: string[] = [];
  for (const event of timeline) {
    const text = guestTextFromTimeline(event);
    if (text?.trim()) messages.push(text.trim());
  }
  return messages;
}

export function detectEngagementDrop(guestMessages: string[]): boolean {
  if (guestMessages.length < 4) return false;

  const recent = guestMessages.slice(-3);
  const shortRecent = recent.filter(
    (message) =>
      message.length <= 8 || SHORT_REPLY_PATTERN.test(message.trim())
  ).length;
  if (shortRecent < 2) return false;

  const earlier = guestMessages.slice(0, -3);
  if (earlier.length === 0) return false;

  const earlierAvg =
    earlier.reduce((sum, message) => sum + message.length, 0) / earlier.length;
  return earlierAvg > 15;
}

function oldestKitchenWaitMinutes(
  orders: OrderFact[],
  nowMs: number
): number | null {
  const waiting = orders.filter((order) =>
    KITCHEN_WAIT_STATUSES.includes(order.status)
  );
  if (!waiting.length) return null;

  const oldestMs = Math.min(
    ...waiting.map((order) => Date.parse(order.createdAt))
  );
  if (!Number.isFinite(oldestMs)) return null;
  return Math.max(0, Math.floor((nowMs - oldestMs) / 60_000));
}

function hasRecentComplaint(guestMessages: string[]): boolean {
  const tail = guestMessages.slice(-2);
  return tail.some((message) => isGuestServiceComplaintMessage(message));
}

/** Deterministic pre-complaint signals — no LLM. */
export function detectPredictiveRecovery(input: {
  orders: OrderFact[];
  guestMessages: string[];
  orderDelayMinutes?: number;
  nowMs?: number;
}): PredictiveRecoveryResult {
  const nowMs = input.nowMs ?? Date.now();
  const signals: PredictiveRecoverySignal[] = [];
  const kitchenWaitMinutes = oldestKitchenWaitMinutes(input.orders, nowMs);
  const proactiveKitchenMinutes = Math.max(
    DEFAULT_PREDICTIVE_KITCHEN_MINUTES,
    input.orderDelayMinutes ?? DEFAULT_PREDICTIVE_KITCHEN_MINUTES
  );

  if (
    kitchenWaitMinutes != null &&
    kitchenWaitMinutes >= proactiveKitchenMinutes &&
    !hasRecentComplaint(input.guestMessages)
  ) {
    signals.push("kitchen_delay_proactive");
  }

  if (
    detectEngagementDrop(input.guestMessages) &&
    !hasRecentComplaint(input.guestMessages)
  ) {
    signals.push("engagement_drop");
  }

  const shouldBoostEmpathy =
    signals.includes("kitchen_delay_proactive") ||
    (signals.includes("engagement_drop") && kitchenWaitMinutes != null);

  return {
    signals,
    kitchenWaitMinutes,
    shouldBoostEmpathy,
  };
}

export function detectPredictiveRecoveryFromTimeline(input: {
  orders: OrderFact[];
  timeline: DenisTimelineRow[];
  orderDelayMinutes?: number;
  nowMs?: number;
}): PredictiveRecoveryResult {
  return detectPredictiveRecovery({
    orders: input.orders,
    guestMessages: extractGuestMessagesFromTimeline(input.timeline),
    orderDelayMinutes: input.orderDelayMinutes,
    nowMs: input.nowMs,
  });
}
