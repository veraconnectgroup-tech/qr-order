import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  detectDessertTrigger,
  detectOrderDelayTrigger,
  detectPairingTrigger,
  detectSlowKitchenTrigger,
} from "@/lib/ai/proactive-triggers";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  buildBrowseFollowUpMessage,
  buildVenueWelcomeMessage,
  resolveFollowUpDueAt,
} from "@/lib/denis/cognition/conversation/guest-continuity";
import type {
  GuestProactiveNudge,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";

function isDismissed(keys: string[], key: string): boolean {
  return keys.includes(key);
}

function buildWelcomeMessage(
  venueName: string | null | undefined,
  language: string | null | undefined,
  todaySpecial: string | null | undefined,
  fallback: string
): string {
  const special = todaySpecial?.trim();
  const venue = venueName?.trim();
  const lang = language?.trim() || "sr";
  if (venue) {
    const base = buildVenueWelcomeMessage(venue, lang);
    if (special) {
      return `${base} Specijal danas: ${special}.`;
    }
    return base;
  }
  if (special) {
    return `Dobro došli! Naš specijal danas je ${special}. Hoćete da pogledate meni?`;
  }
  return fallback;
}

function buildDessertMessage(
  dessertProductName: string | null | undefined,
  fallback: string
): string {
  const dessert = dessertProductName?.trim();
  if (!dessert) return fallback;
  return `Kako vam je bilo? Imamo odličan ${dessert} — hoćete da dodam?`;
}

function buildPopularityMessage(
  pair: { from: string; to: string } | null | undefined,
  fallback: string
): string {
  if (!pair?.from?.trim() || !pair?.to?.trim()) return fallback;
  return `Gosti koji naruče ${pair.from} često uzmu i ${pair.to}. Hoćete da dodam?`;
}

/** Trigger detection only — venue feature flags enforced in TDE (`decideProactiveTurnPlan`). */
export function detectProactiveCandidate(input: {
  config: Pick<ConciergeConfig, "proactive" | "upsell">;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
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
}): GuestProactiveNudge | null {
  const { config, orders, payload, messages } = input;
  const now = input.now ?? Date.now();
  const dismissed = payload.dismissedNudgeKeys ?? [];
  const hasOrdered =
    (payload.cartItemCount ?? 0) > 0 || Boolean(payload.hasSessionOrders);

  if (
    config.proactive.guestWelcome &&
    !isDismissed(dismissed, "guest_welcome") &&
    (payload.guestMessageCount ?? 0) === 0 &&
    (payload.sessionAgeSeconds ?? 0) >= config.proactive.guestWelcomeSeconds
  ) {
    return {
      kind: "guest_welcome",
      message: buildWelcomeMessage(
        payload.venueName,
        payload.language,
        payload.todaySpecial,
        messages.guestWelcome
      ),
    };
  }

  if (
    config.proactive.browseFollowUp &&
    payload.browsingDeferredAt &&
    !payload.browseFollowUpEmitted &&
    !isDismissed(dismissed, "browse_follow_up") &&
    !hasOrdered &&
    (payload.guestMessageCount ?? 0) > 0
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
      return {
        kind: "browse_follow_up",
        message: messages.browseFollowUp,
      };
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
      return {
        kind: "slow_kitchen",
        message: messages.slowKitchen,
        orderId: slow.orderId,
      };
    }
  }

  if (
    config.proactive.orderDelay &&
    !isDismissed(dismissed, "order_delay")
  ) {
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
      return {
        kind: "order_delay",
        message: messages.orderDelay,
        orderId: delay.orderId,
      };
    }
  }

  const skipDessertWhileBrowsing =
    payload.sessionPhase === "browsing" && orders.length > 0;

  if (!isDismissed(dismissed, "dessert_nudge") && !skipDessertWhileBrowsing) {
    const dessert = detectDessertTrigger(
      orders,
      () => isDismissed(dismissed, "dessert_nudge"),
      now,
      {
        minMinutes: input.config.upsell.dessertDelayMinutes,
        maxMinutes: null,
        preparingMinMinutes: input.config.upsell.dessertDelayMinutes,
      }
    );
    const suppressPreparingDessertWhileWaiting =
      payload.sessionPhase === "waiting" && Boolean(dessert?.orderId);
    if (dessert && !suppressPreparingDessertWhileWaiting) {
      return {
        kind: "dessert_nudge",
        message: buildDessertMessage(
          payload.dessertProductName,
          messages.dessert
        ),
        orderId: dessert.orderId,
        prompt: dessert.prompt,
      };
    }
  }

  if (
    config.proactive.billPrompt &&
    !isDismissed(dismissed, "bill_prompt") &&
    (payload.idleMinutes ?? 0) >= config.proactive.billPromptMinutes
  ) {
    const delivered = orders
      .filter((order) => order.status === "delivered")
      .sort(
        (a, b) =>
          new Date(b.delivered_at ?? b.created_at).getTime() -
          new Date(a.delivered_at ?? a.created_at).getTime()
      );
    const latest = delivered[0];
    if (latest) {
      const reference = latest.delivered_at ?? latest.created_at;
      const mins =
        (now - new Date(reference).getTime()) / 60_000;
      if (mins >= config.proactive.billPromptMinutes) {
        return { kind: "bill_prompt", message: messages.billPrompt };
      }
    }
  }

  if (
    config.proactive.popularityPairing &&
    !isDismissed(dismissed, "popularity_pair") &&
    payload.popularityPair &&
    (payload.guestAskedRecommendation ||
      (payload.browseMinutes ?? 0) >=
        config.proactive.popularityBrowseMinutes)
  ) {
    return {
      kind: "popularity_pair",
      message: buildPopularityMessage(
        payload.popularityPair,
        messages.popularityPair
      ),
    };
  }

  if (
    !isDismissed(dismissed, "browse_nudge") &&
    (payload.browseMinutes ?? 0) >= config.proactive.browseNudgeMinutes &&
    !hasOrdered
  ) {
    return { kind: "browse_nudge", message: messages.browse };
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
      return {
        kind: "drink_pairing",
        message: "",
        orderId: pairing.orderId,
        prompt: pairing.prompt,
      };
    }
  }

  return null;
}
