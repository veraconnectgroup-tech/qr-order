import type { DeclineState } from "@/lib/denis/cognition/mental-model/decline-state";
import {
  deriveSessionNudgeFatigue,
} from "@/lib/denis/cognition/mental-model/derive-session-nudge-fatigue";
import type {
  GuestNudgeBudget,
  GuestReceptiveness,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import type { NudgeOutcomeKind } from "@/lib/denis/cognition/offer/nudge-outcome-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

const UPSERT_NUDGE_KIND =
  /^(guest_welcome|browse_nudge|cart_recovery|cart_abandonment_prevention|popularity_pair|dessert_nudge|bill_prompt|browse_follow_up|scroll_search|scroll_category|scroll_bottom|timed_nudge|category_nudge|cart_nudge|exit_intent)$/;

export function deriveNudgeBudget(input: {
  spine: GuestSignalSpine;
  decline: DeclineState;
  receptiveness: GuestReceptiveness;
  config: ConciergeConfig;
  now: number;
  resolvedOutcomes?: NudgeOutcomeKind[];
}): GuestNudgeBudget {
  const mentalConfig = input.config.mentalModel;

  if (input.decline.hardClosed || input.receptiveness === "closed") {
    return { remaining: 0, max: 0, cooldownUntil: null };
  }

  const fatigue = deriveSessionNudgeFatigue(input.resolvedOutcomes ?? []);
  if (fatigue === "exhausted") {
    return { remaining: 0, max: 0, cooldownUntil: null };
  }

  let max =
    input.receptiveness === "enthusiastic"
      ? mentalConfig.nudgeBudgetEnthusiastic
      : mentalConfig.nudgeBudgetDefault;

  if (fatigue === "cooling") {
    max = Math.max(1, max - 1);
  }

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
