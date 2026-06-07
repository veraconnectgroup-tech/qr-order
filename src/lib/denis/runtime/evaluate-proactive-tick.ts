import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import type {
  GuestProactiveNudge,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { AiGuestOrder } from "@/lib/ai/order-context";

export type { GuestProactiveNudge, ProactiveTickPayload };

/** Legacy M11 helper — rank top candidate with venue flags (mode=off path). */
export function evaluateGuestProactiveTick(input: {
  config: ConciergeConfig;
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
  const { config } = input;
  if (!config.proactive.enabled) return null;

  const candidate = rankProactiveCandidates(input)[0]?.nudge ?? null;
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
