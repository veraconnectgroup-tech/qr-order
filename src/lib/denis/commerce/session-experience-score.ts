import type { GuestFrustrationLevel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  computeRealtimeExperienceScore,
  type DenisQualitySignal,
  type RealtimeExperienceFactors,
  type RealtimeExperienceResult,
} from "@/lib/commerce/experience/resolve-experience-moment";
import type { OrderFact, TableSessionState } from "@/lib/denis/loop/types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

export type SessionExperienceScoreComponents = {
  conversationQuality: number;
  kitchenSpeed: number;
  orderAccuracy: number;
  mood: number;
};

export type SessionExperienceScore = {
  overallScore: number;
  components: SessionExperienceScoreComponents;
  realtime: RealtimeExperienceResult;
};

function resolveWaitMinutes(orders: OrderFact[]): number | null {
  const delivered = orders.filter(
    (order) => order.status === "delivered" && order.deliveredAt
  );
  if (!delivered.length) return null;

  const waits = delivered.map((order) => {
    const created = new Date(order.createdAt).getTime();
    const done = new Date(order.deliveredAt!).getTime();
    return Math.max(0, (done - created) / 60_000);
  });

  return waits.reduce((sum, value) => sum + value, 0) / waits.length;
}

function resolveDenisQuality(mental: GuestMentalModel): DenisQualitySignal {
  const frustration = mental.affect.frustration.level;
  if (frustration === "high") return "poor";
  if (
    mental.receptiveness === "closed" ||
    mental.receptiveness === "polite_decline" ||
    mental.predictedNeed === "needs_attention"
  ) {
    return "poor";
  }
  if (
    mental.receptiveness === "enthusiastic" ||
    mental.affect.sentiment.score >= 0.2
  ) {
    return "good";
  }
  if (frustration === "mild") return "neutral";
  return "neutral";
}

function resolveOrderAccuracy(state: TableSessionState): boolean | null {
  const delivered = state.commerce.orders.some(
    (order) => order.status === "delivered"
  );
  if (!delivered) return null;

  if ((state.conversation.obligation?.gaps.length ?? 0) > 0) {
    return false;
  }
  if (state.browse.cartAbandoned.length >= 2) {
    return false;
  }
  return true;
}

function countFrustrationEvents(state: TableSessionState): number {
  let count = 0;
  const frustration = state.mental.affect.frustration.level;
  if (frustration === "high") count += 2;
  else if (frustration === "mild") count += 1;

  const timeline = state.timeline ?? [];
  for (const row of timeline) {
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : null;
    if (row.event_type === "waiter.call.created") count += 1;
    if (payload?.type === "staff_frustrated_guest") count += 1;
  }

  return count;
}

function resolveProactiveHelpful(state: TableSessionState): boolean {
  const timeline = state.timeline ?? [];
  for (const row of timeline) {
    if (row.event_type !== "proactive.emitted") continue;
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : null;
    if (payload?.outcome === "accepted") return true;
  }

  return state.mental.receptiveness === "enthusiastic";
}

/** Map folded table session → realtime experience factor input. */
export function mapSessionToExperienceFactors(
  state: Pick<
    TableSessionState,
    | "mental"
    | "commerce"
    | "conversation"
    | "browse"
    | "session"
    | "venue"
    | "offer"
  >
): RealtimeExperienceFactors {
  return {
    waitMinutes: resolveWaitMinutes(state.commerce.orders),
    denisQuality: resolveDenisQuality(state.mental),
    orderAccurate: resolveOrderAccuracy(state as TableSessionState),
    proactiveHelpful: resolveProactiveHelpful(state as TableSessionState),
    frustrationEvents: countFrustrationEvents(state as TableSessionState),
  };
}

function legacyComponentsFromRealtime(
  factors: RealtimeExperienceFactors,
  result: RealtimeExperienceResult
): SessionExperienceScoreComponents {
  return {
    conversationQuality:
      factors.denisQuality === "good"
        ? 9
        : factors.denisQuality === "poor"
          ? 3
          : 6,
    kitchenSpeed:
      factors.waitMinutes == null
        ? 7
        : factors.waitMinutes < 10
          ? 9
          : factors.waitMinutes <= 20
            ? 6
            : 3,
    orderAccuracy:
      factors.orderAccurate === true
        ? 9
        : factors.orderAccurate === false
          ? 3
          : 7,
    mood: result.score,
  };
}

/** Per-session experience score (0–10) — realtime factor model (Prompt 78). */
export function buildSessionExperienceScore(
  state: Pick<
    TableSessionState,
    | "mental"
    | "commerce"
    | "conversation"
    | "browse"
    | "session"
    | "venue"
    | "offer"
  >
): SessionExperienceScore {
  const factors = mapSessionToExperienceFactors(state);
  const realtime = computeRealtimeExperienceScore(factors);

  return {
    overallScore: realtime.score,
    components: legacyComponentsFromRealtime(factors, realtime),
    realtime,
  };
}

export function resolvePaidAnchorAt(orders: OrderFact[]): string | null {
  const paid = orders.filter((order) =>
    isPaidPaymentStatus(order.paymentStatus)
  );
  const latest = paid[paid.length - 1];
  if (!latest) return null;
  return latest.deliveredAt ?? latest.createdAt;
}

export function frustrationFromMental(
  mental: GuestMentalModel
): GuestFrustrationLevel {
  return mental.affect.frustration.level;
}
