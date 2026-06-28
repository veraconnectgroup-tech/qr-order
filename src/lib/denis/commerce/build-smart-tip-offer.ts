import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";
import type { FeedbackSentiment } from "@/lib/commerce/experience/resolve-experience-moment";
import { isReturningGuest } from "@/lib/denis/loop/derive-contextual-chips";
import type { OrderFact, TableSessionState } from "@/lib/denis/loop/types";
import type { SmartTipOffer } from "@/lib/denis/loop/view-types";
import {
  resolveTipMarketRegion,
  resolveTipSuggestion,
  tipAmountFromPercent,
  type TipMarketRegion,
} from "@/lib/denis/commerce/smart-tips";
import { buildSessionExperienceScore } from "@/lib/denis/commerce/session-experience-score";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import type { SessionPhase } from "@/lib/scene/types";

const MEAL_PHASES: SessionPhase[] = ["browsing", "ordering", "waiting"];

function sessionOrderTotal(orders: OrderFact[]): number {
  let cents = 0;
  for (const order of orders) {
    for (const item of order.items) {
      if (item.lineTotalCents != null) {
        cents += item.lineTotalCents;
      }
    }
  }
  return cents / 100;
}

function sessionHasTip(orders: OrderFact[]): boolean {
  return orders.some((order) => (order.tipAmount ?? 0) > 0);
}

function resolveWaitTimeMinutes(orders: OrderFact[], nowMs: number): number {
  const waits: number[] = [];
  for (const order of orders) {
    if (order.status !== "delivered" || !order.deliveredAt) continue;
    const created = new Date(order.createdAt).getTime();
    const delivered = new Date(order.deliveredAt).getTime();
    if (delivered >= created) {
      waits.push((delivered - created) / 60_000);
    }
  }
  if (!waits.length) return 0;
  return Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length);
}

function resolveFeedbackRating(state: TableSessionState): {
  rating: number | null;
  sentiment: FeedbackSentiment | null;
} {
  const memory = state.guest;
  if (state.session.feedbackSubmitted && memory?.lastFeedbackSentiment) {
    const sentiment = memory.lastFeedbackSentiment;
    const rating =
      sentiment === "positive" ? 5 : sentiment === "neutral" ? 3 : 2;
    return { rating, sentiment };
  }
  return { rating: null, sentiment: null };
}

function resolveTipTargetOrder(orders: OrderFact[]): OrderFact | null {
  const paid = orders.filter((order) => isPaidPaymentStatus(order.paymentStatus));
  if (!paid.length) return null;
  return paid[paid.length - 1] ?? null;
}

function resolvePolicyMarketRegion(
  params: Record<string, unknown>,
  language?: string
): TipMarketRegion {
  const raw = params.marketRegion;
  if (raw === "de" || raw === "us" || raw === "balkan") {
    return raw;
  }
  return resolveTipMarketRegion({ language });
}

export function resolveSmartTipEligibility(input: {
  phase: SessionPhase;
  orders: OrderFact[];
  feedbackSubmitted: boolean;
  billSettled: boolean;
  nowMs?: number;
}): boolean {
  if (MEAL_PHASES.includes(input.phase)) return false;
  if (input.orders.length === 0) return false;
  if (sessionHasTip(input.orders)) return false;

  const allPaid = input.orders.every((order) =>
    isPaidPaymentStatus(order.paymentStatus)
  );
  const allDelivered =
    input.orders.length > 0 &&
    input.orders.every((order) => order.status === "delivered");

  if (!allPaid && !input.billSettled) return false;

  if (input.feedbackSubmitted) {
    return allDelivered || input.billSettled || allPaid;
  }

  return (input.billSettled || allPaid) && (allDelivered || input.billSettled);
}

/** Build guest smart-tip sheet offer (P37) — deterministic, no LLM. */
export function buildSmartTipOffer(input: {
  state: TableSessionState;
  phase: SessionPhase;
  language?: string;
  waiterName?: string | null;
  nowMs?: number;
  policy?: CommercePolicy;
}): SmartTipOffer | null {
  const cohortKey =
    input.state.session.id || input.state.table.token || "tips";
  const policy = input.policy ?? DEFAULT_COMMERCE_POLICY;
  if (
    !isCommerceCapabilityActive({
      capabilityId: "tips.smart_defaults",
      cohortKey,
      policy,
    })
  ) {
    return null;
  }

  const nowMs = input.nowMs ?? Date.now();
  if (
    !resolveSmartTipEligibility({
      phase: input.phase,
      orders: input.state.commerce.orders,
      feedbackSubmitted: input.state.session.feedbackSubmitted,
      billSettled: input.state.session.billSettled,
      nowMs,
    })
  ) {
    return null;
  }

  const targetOrder = resolveTipTargetOrder(input.state.commerce.orders);
  if (!targetOrder) return null;

  const orderTotal = sessionOrderTotal(input.state.commerce.orders);
  if (orderTotal <= 0) return null;

  const feedback = resolveFeedbackRating(input.state);
  const config = policy.capabilities["tips.smart_defaults"];
  const venueAvgTipPercent =
    typeof config.params.venueAvgTipPercent === "number"
      ? config.params.venueAvgTipPercent
      : 15;
  const marketRegion = resolvePolicyMarketRegion(
    config.params,
    input.language
  );

  const experienceScore = buildSessionExperienceScore(input.state).overallScore;

  const suggestion = resolveTipSuggestion({
    orderTotal,
    feedbackRating: feedback.rating,
    feedbackSentiment: feedback.sentiment,
    frustrationLevel: input.state.mental.affect.frustration.level,
    waitTimeMinutes: resolveWaitTimeMinutes(
      input.state.commerce.orders,
      nowMs
    ),
    isReturningGuest: isReturningGuest(input.state.guest),
    venueAvgTipPercent,
    experienceScore,
    waiterName: input.waiterName,
    language: input.language,
    marketRegion,
  });

  const presetAmounts = suggestion.presets.map((percent) =>
    tipAmountFromPercent(orderTotal, percent)
  );

  return {
    orderId: targetOrder.id,
    orderTotal,
    presets: suggestion.presets,
    presetAmounts,
    defaultIndex: suggestion.defaultIndex,
    defaultPercent: suggestion.defaultPercent,
    personalMessage: suggestion.personalMessage ?? "",
    denisMessage: suggestion.denisMessage,
    sentiment: suggestion.sentiment,
    showProminent: suggestion.showProminent,
    titleKey: suggestion.titleKey,
    allowSkip: suggestion.allowSkip,
    experienceScore: suggestion.experienceScore,
    marketRegion: suggestion.marketRegion,
  };
}
