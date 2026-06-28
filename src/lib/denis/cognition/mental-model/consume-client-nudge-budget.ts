import type { GuestNudgeBudget } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  CLIENT_NUDGE_BUDGET_MAX,
  CLIENT_NUDGE_DISMISS_STOP,
  deriveClientNudgeBudget,
} from "@/lib/guest/scroll-intelligence";

/** Client-side nudge budget consumption aligned with GuestNudgeBudget shape. */
export function consumeClientNudgeBudget(input: {
  shown: number;
  dismissed: number;
  max?: number;
}): GuestNudgeBudget {
  const budget = deriveClientNudgeBudget(input);
  return {
    remaining: budget.remaining,
    max: budget.max,
    cooldownUntil:
      budget.stopped && input.dismissed >= CLIENT_NUDGE_DISMISS_STOP
        ? Date.now() + 30 * 60_000
        : null,
  };
}

export function mergeClientNudgeBudgetWithServer(input: {
  clientDismissed: number;
  clientShown: number;
  serverBudget: GuestNudgeBudget;
}): GuestNudgeBudget {
  const client = deriveClientNudgeBudget({
    shown: input.clientShown,
    dismissed: input.clientDismissed,
    max: input.serverBudget.max || CLIENT_NUDGE_BUDGET_MAX,
  });

  if (client.stopped) {
    return { remaining: 0, max: client.max, cooldownUntil: Date.now() + 30 * 60_000 };
  }

  return {
    remaining: Math.min(input.serverBudget.remaining, client.remaining),
    max: Math.min(input.serverBudget.max, client.max),
    cooldownUntil: input.serverBudget.cooldownUntil,
  };
}
