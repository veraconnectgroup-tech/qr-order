import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  detectDessertTrigger,
  detectPairingTrigger,
  detectSlowKitchenTrigger,
} from "@/lib/ai/proactive-triggers";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type ProactiveTickPayload = {
  browseMinutes?: number;
  cartItemCount?: number;
  hasSessionOrders?: boolean;
  hasDrinkInCart?: boolean;
  dismissedNudgeKeys?: string[];
};

export type GuestProactiveNudge = {
  kind: "browse_nudge" | "drink_pairing" | "dessert_nudge" | "slow_kitchen";
  message: string;
  orderId?: string;
  prompt?: string;
};

function isDismissed(keys: Set<string>, key: string): boolean {
  return keys.has(key);
}

/** Trigger detection only — venue feature flags enforced in TDE (`decideProactiveTurnPlan`). */
export function detectProactiveCandidate(input: {
  config: Pick<ConciergeConfig, "proactive">;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
  };
  now?: number;
}): GuestProactiveNudge | null {
  const { config, orders, payload, messages } = input;
  const now = input.now ?? Date.now();
  const dismissed = new Set(payload.dismissedNudgeKeys ?? []);
  const hasOrdered =
    (payload.cartItemCount ?? 0) > 0 || Boolean(payload.hasSessionOrders);

  if (
    !isDismissed(dismissed, "browse_nudge") &&
    (payload.browseMinutes ?? 0) >= config.proactive.browseNudgeMinutes &&
    !hasOrdered
  ) {
    return { kind: "browse_nudge", message: messages.browse };
  }

  if (
    !payload.hasDrinkInCart &&
    !isDismissed(dismissed, "drink_pairing")
  ) {
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

  if (!isDismissed(dismissed, "dessert_nudge")) {
    const dessert = detectDessertTrigger(
      orders,
      () => isDismissed(dismissed, "dessert_nudge"),
      now
    );
    if (dessert) {
      return { kind: "dessert_nudge", message: messages.dessert };
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

  return null;
}

/** Legacy M11 helper — applies venue flags before returning candidate. */
export function evaluateGuestProactiveTick(input: {
  config: ConciergeConfig;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
  };
  now?: number;
}): GuestProactiveNudge | null {
  const { config } = input;
  if (!config.proactive.enabled) return null;

  const candidate = detectProactiveCandidate(input);
  if (!candidate) return null;

  if (candidate.kind === "drink_pairing" && !config.proactive.pairing) {
    return null;
  }
  if (candidate.kind === "dessert_nudge" && !config.proactive.dessert) {
    return null;
  }
  if (candidate.kind === "slow_kitchen" && !config.proactive.slowKitchen) {
    return null;
  }

  return candidate;
}
