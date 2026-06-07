import type { DeclineState } from "@/lib/denis/cognition/mental-model/decline-state";
import type {
  GuestNudgeBudget,
  GuestReceptiveness,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

const UPSERT_NUDGE_KIND =
  /^(guest_welcome|browse_nudge|popularity_pair|dessert_nudge|bill_prompt|browse_follow_up)$/;

export function deriveNudgeBudget(input: {
  spine: GuestSignalSpine;
  decline: DeclineState;
  receptiveness: GuestReceptiveness;
  config: ConciergeConfig;
  now: number;
}): GuestNudgeBudget {
  const mentalConfig = input.config.mentalModel;

  if (input.decline.hardClosed || input.receptiveness === "closed") {
    return { remaining: 0, max: 0, cooldownUntil: null };
  }

  const max =
    input.receptiveness === "enthusiastic"
      ? mentalConfig.nudgeBudgetEnthusiastic
      : mentalConfig.nudgeBudgetDefault;

  const emitted = input.spine.emittedProactiveKeys.filter((key) =>
    UPSERT_NUDGE_KIND.test(key.split(":")[0] ?? key)
  ).length;

  let cooldownUntil: number | null = null;
  const declineEvents =
    input.decline.explicitCount + input.decline.dismissedCount;
  if (declineEvents >= 2 && input.decline.lastDeclineAt != null) {
    cooldownUntil =
      input.decline.lastDeclineAt + mentalConfig.declineCooldownSeconds * 1000;
    if (cooldownUntil <= input.now) cooldownUntil = null;
  }

  const spent = Math.max(emitted, input.decline.dismissedCount);
  const remaining = Math.max(0, max - spent);

  return { remaining, max, cooldownUntil };
}
