import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { detectProactiveCandidate } from "@/lib/denis/cognition/proactive/detect-proactive-candidate";
import type {
  GuestProactiveNudge,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { AiGuestOrder } from "@/lib/ai/order-context";

export type { GuestProactiveNudge, ProactiveTickPayload };
export { detectProactiveCandidate };

/** Legacy M11 helper — applies venue flags before returning candidate. */
export function evaluateGuestProactiveTick(input: {
  config: ConciergeConfig;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
    guestWelcome: string;
    billPrompt: string;
    orderDelay: string;
    popularityPair: string;
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
