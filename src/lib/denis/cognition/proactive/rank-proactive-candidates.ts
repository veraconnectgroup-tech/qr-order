import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  detectDessertTrigger,
  detectOrderDelayTrigger,
  detectPairingTrigger,
  detectSlowKitchenTrigger,
  resolveEnforceDessertPosture,
} from "@/lib/denis/cognition/proactive/triggers";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { resolveFollowUpDueAt } from "@/lib/denis/cognition/conversation/guest-continuity";
import { buildAttentionHandoffMessage } from "@/lib/denis/cognition/proactive/build-attention-handoff-message";
import {
  buildDessertMessage,
  buildPopularityMessage,
  buildWelcomeMessage,
} from "@/lib/denis/cognition/proactive/proactive-message-builders";
import type {
  GuestProactiveNudge,
  GuestProactiveNudgeKind,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";

export type RankedProactiveCandidate = {
  nudge: GuestProactiveNudge;
  priority: number;
  source: string;
};

export type RankProactiveCandidatesInput = {
  config: Pick<ConciergeConfig, "proactive" | "upsell" | "mentalModel" | "handoff">;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
  mental?: GuestMentalModel | null;
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
    guestWelcome: string;
    browseFollowUp: string;
    billPrompt: string;
    orderDelay: string;
    popularityPair: string;
  };
  now?: number;
};

function isDismissed(keys: string[], key: string): boolean {
  return keys.includes(key);
}

function isMentalFirst(config: RankProactiveCandidatesInput["config"]): boolean {
  return resolveMentalModelMode(config as ConciergeConfig) !== "off";
}

function isEnforceMode(config: RankProactiveCandidatesInput["config"]): boolean {
  return resolveMentalModelMode(config as ConciergeConfig) === "enforce";
}

const LEGACY_KIND_PRIORITY: Record<GuestProactiveNudgeKind, number> = {
  attention_handoff: 1050,
  guest_welcome: 1000,
  browse_follow_up: 900,
  slow_kitchen: 850,
  order_delay: 840,
  dessert_nudge: 700,
  bill_prompt: 680,
  popularity_pair: 600,
  browse_nudge: 500,
  cart_recovery: 960,
  drink_pairing: 400,
  waiter_gap: 950,
};

function posturePriority(
  kind: GuestProactiveNudgeKind,
  mental: GuestMentalModel
): number {
  const need = mental.predictedNeed;
  const table: Partial<Record<GuestProactiveNudgeKind, number>> = {
    attention_handoff: 1100,
    order_delay: need === "needs_attention" ? 1000 : 820,
    slow_kitchen: need === "needs_attention" ? 990 : 810,
    bill_prompt: need === "wants_bill" ? 980 : 670,
    dessert_nudge: need === "wants_dessert" ? 970 : 690,
    browse_follow_up: need === "needs_help_choosing" ? 960 : 880,
    browse_nudge: need === "needs_help_choosing" ? 950 : 490,
    cart_recovery: need === "needs_help_choosing" ? 965 : 955,
    popularity_pair: need === "needs_help_choosing" ? 940 : 590,
    guest_welcome: mental.intent === "arrived" ? 930 : 990,
    drink_pairing: 750,
  };

  return table[kind] ?? LEGACY_KIND_PRIORITY[kind] ?? 0;
}

function priorityForKind(
  kind: GuestProactiveNudgeKind,
  mentalFirst: boolean,
  mental: GuestMentalModel | null | undefined
): number {
  if (mentalFirst && mental) {
    return posturePriority(kind, mental);
  }
  return LEGACY_KIND_PRIORITY[kind] ?? 0;
}

function pushCandidate(
  bucket: RankedProactiveCandidate[],
  nudge: GuestProactiveNudge,
  source: string,
  mentalFirst: boolean,
  mental: GuestMentalModel | null | undefined
): void {
  bucket.push({
    nudge,
    priority: priorityForKind(nudge.kind, mentalFirst, mental),
    source,
  });
}

function shouldOfferGuestWelcome(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  guestMessageCount: number;
}): boolean {
  if (input.enforceMode) return input.guestMessageCount === 0;
  if (input.mentalFirst && input.mental) {
    return (
      input.mental.intent === "arrived" && !input.mental.engagement.guestInitiated
    );
  }
  return input.guestMessageCount === 0;
}

function shouldOfferBrowseNudge(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  browseMinutes: number;
  thresholdMinutes: number;
}): boolean {
  if (input.enforceMode) return true;
  if (input.mentalFirst && input.mental) {
    return (
      (input.mental.intent === "exploring" || input.mental.intent === "comparing") &&
      input.mental.predictedNeed === "needs_help_choosing"
    );
  }
  return input.browseMinutes >= input.thresholdMinutes;
}

function shouldOfferPopularityPair(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  guestAskedRecommendation: boolean;
  browseMinutes: number;
  thresholdMinutes: number;
}): boolean {
  if (input.enforceMode) return true;
  if (input.mentalFirst && input.mental) {
    return (
      input.guestAskedRecommendation ||
      input.mental.intent === "comparing" ||
      (input.mental.intent === "exploring" &&
        input.mental.predictedNeed === "needs_help_choosing")
    );
  }
  return (
    input.guestAskedRecommendation || input.browseMinutes >= input.thresholdMinutes
  );
}

function shouldOfferBillPrompt(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
  idleMinutes: number;
  thresholdMinutes: number;
  orders: AiGuestOrder[];
  now: number;
}): boolean {
  if (input.enforceMode) return true;
  if (input.mentalFirst && input.mental) {
    return (
      (input.mental.mealStage === "post_meal" || input.mental.mealStage === "paying") &&
      input.mental.predictedNeed === "wants_bill"
    );
  }

  if (input.idleMinutes < input.thresholdMinutes) return false;

  const delivered = input.orders
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    );
  const latest = delivered[0];
  if (!latest) return false;

  const reference = latest.delivered_at ?? latest.created_at;
  const mins = (input.now - new Date(reference).getTime()) / 60_000;
  return mins >= input.thresholdMinutes;
}

function shouldOfferDessert(input: {
  enforceMode: boolean;
  mentalFirst: boolean;
  mental?: GuestMentalModel | null;
}): boolean {
  if (input.enforceMode) return true;
  if (!input.mentalFirst || !input.mental) return true;
  return (
    input.mental.mealStage === "dessert_window" &&
    input.mental.predictedNeed === "wants_dessert"
  );
}

/** Collect all eligible proactive candidates, scored by posture (ADR-038 GMM-6). */
export function rankProactiveCandidates(
  input: RankProactiveCandidatesInput
): RankedProactiveCandidate[] {
  const { config, orders, payload, messages, mental } = input;
  const now = input.now ?? Date.now();
  const dismissed = payload.dismissedNudgeKeys ?? [];
  const hasOrdered =
    (payload.cartItemCount ?? 0) > 0 || Boolean(payload.hasSessionOrders);
  const guestRequestedFollowUp = Boolean(payload.followUpRequestedAt);
  const mentalFirst = isMentalFirst(config);
  const enforceMode = isEnforceMode(config);
  const browseMinutes = payload.browseMinutes ?? 0;
  const idleMinutes = payload.idleMinutes ?? 0;
  const guestMessageCount = payload.guestMessageCount ?? 0;
  const candidates: RankedProactiveCandidate[] = [];

  if (
    mentalFirst &&
    mental?.predictedNeed === "needs_attention" &&
    !isDismissed(dismissed, "attention_handoff") &&
    config.handoff.waiterCall
  ) {
    pushCandidate(
      candidates,
      {
        kind: "attention_handoff",
        message: buildAttentionHandoffMessage(payload.language),
      },
      "attention_handoff",
      mentalFirst,
      mental
    );
  }

  if (
    config.proactive.guestWelcome &&
    !isDismissed(dismissed, "guest_welcome") &&
    shouldOfferGuestWelcome({ enforceMode, mentalFirst, mental, guestMessageCount }) &&
    (payload.sessionAgeSeconds ?? 0) >= config.proactive.guestWelcomeSeconds
  ) {
    pushCandidate(
      candidates,
      {
        kind: "guest_welcome",
        message: buildWelcomeMessage(
          payload.venueName,
          payload.language,
          payload.todaySpecial,
          messages.guestWelcome,
          payload.rhythmTopProductName
        ),
      },
      "welcome",
      mentalFirst,
      mental
    );
  }

  if (
    config.proactive.browseFollowUp &&
    payload.browsingDeferredAt &&
    !payload.browseFollowUpEmitted &&
    !isDismissed(dismissed, "browse_follow_up") &&
    (guestRequestedFollowUp || !hasOrdered) &&
    guestMessageCount > 0
  ) {
    const dueAt = resolveFollowUpDueAt(
      {
        lastDeferredAt: payload.browsingDeferredAt,
        deferCount: payload.browsingDeferCount ?? 1,
        followUpEmitted: payload.browseFollowUpEmitted ?? false,
        followUpRequestedAt: payload.followUpRequestedAt ?? null,
        followUpDelaySeconds: payload.followUpDelaySeconds ?? null,
      },
      config.proactive.browseFollowUpSeconds
    );
    if (dueAt != null && now >= dueAt) {
      pushCandidate(
        candidates,
        { kind: "browse_follow_up", message: messages.browseFollowUp },
        "browse_follow_up",
        mentalFirst,
        mental
      );
    }
  }

  if (!isDismissed(dismissed, "slow_kitchen")) {
    const slow = detectSlowKitchenTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `slow_kitchen:${orderId}`) ||
        isDismissed(dismissed, "slow_kitchen"),
      now
    );
    if (slow?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "slow_kitchen",
          message: messages.slowKitchen,
          orderId: slow.orderId,
        },
        "slow_kitchen",
        mentalFirst,
        mental
      );
    }
  }

  if (config.proactive.orderDelay && !isDismissed(dismissed, "order_delay")) {
    const delay = detectOrderDelayTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `order_delay:${orderId}`) ||
        isDismissed(dismissed, "order_delay") ||
        isDismissed(dismissed, `slow_kitchen:${orderId}`) ||
        isDismissed(dismissed, "slow_kitchen"),
      now,
      config.proactive.orderDelayMinutes
    );
    if (delay?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "order_delay",
          message: messages.orderDelay,
          orderId: delay.orderId,
        },
        "order_delay",
        mentalFirst,
        mental
      );
    }
  }

  const skipDessertWhileBrowsing =
    payload.sessionPhase === "browsing" && orders.length > 0;

  if (
    !isDismissed(dismissed, "dessert_nudge") &&
    !skipDessertWhileBrowsing &&
    shouldOfferDessert({ enforceMode, mentalFirst, mental })
  ) {
    const dessert =
      enforceMode && mental
        ? resolveEnforceDessertPosture({ orders, mental })
        : detectDessertTrigger(
            orders,
            () => isDismissed(dismissed, "dessert_nudge"),
            now,
            {
              minMinutes:
                payload.effectiveDessertDelayMinutes ??
                config.upsell.dessertDelayMinutes,
              maxMinutes: null,
              preparingMinMinutes:
                payload.effectiveDessertDelayMinutes ??
                config.upsell.dessertDelayMinutes,
            }
          );
    const suppressPreparingDessertWhileWaiting =
      payload.sessionPhase === "waiting" && Boolean(dessert?.orderId);
    if (dessert && !suppressPreparingDessertWhileWaiting) {
      pushCandidate(
        candidates,
        {
          kind: "dessert_nudge",
          message: buildDessertMessage(
            payload.dessertProductName,
            messages.dessert
          ),
          orderId: dessert.orderId,
          prompt: dessert.prompt,
        },
        "dessert",
        mentalFirst,
        mental
      );
    }
  }

  if (
    config.proactive.billPrompt &&
    !isDismissed(dismissed, "bill_prompt") &&
    shouldOfferBillPrompt({
      enforceMode,
      mentalFirst,
      mental,
      idleMinutes,
      thresholdMinutes: config.proactive.billPromptMinutes,
      orders,
      now,
    })
  ) {
    pushCandidate(
      candidates,
      { kind: "bill_prompt", message: messages.billPrompt },
      "bill",
      mentalFirst,
      mental
    );
  }

  if (
    config.proactive.popularityPairing &&
    !isDismissed(dismissed, "popularity_pair") &&
    payload.popularityPair &&
    shouldOfferPopularityPair({
      enforceMode,
      mentalFirst,
      mental,
      guestAskedRecommendation: Boolean(payload.guestAskedRecommendation),
      browseMinutes,
      thresholdMinutes: config.proactive.popularityBrowseMinutes,
    })
  ) {
    pushCandidate(
      candidates,
      {
        kind: "popularity_pair",
        message: buildPopularityMessage(
          payload.popularityPair,
          messages.popularityPair
        ),
      },
      "popularity",
      mentalFirst,
      mental
    );
  }

  if (
    !isDismissed(dismissed, "browse_nudge") &&
    !hasOrdered &&
    shouldOfferBrowseNudge({
      enforceMode,
      mentalFirst,
      mental,
      browseMinutes,
      thresholdMinutes: config.proactive.browseNudgeMinutes,
    })
  ) {
    pushCandidate(
      candidates,
      { kind: "browse_nudge", message: messages.browse },
      "browse",
      mentalFirst,
      mental
    );
  }

  if (!payload.hasDrinkInCart && !isDismissed(dismissed, "drink_pairing")) {
    const pairing = detectPairingTrigger(
      orders,
      (orderId) =>
        isDismissed(dismissed, `drink_pairing:${orderId}`) ||
        isDismissed(dismissed, "drink_pairing"),
      now
    );
    if (pairing?.orderId) {
      pushCandidate(
        candidates,
        {
          kind: "drink_pairing",
          message: "",
          orderId: pairing.orderId,
          prompt: pairing.prompt,
        },
        "drink_pairing",
        mentalFirst,
        mental
      );
    }
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}
