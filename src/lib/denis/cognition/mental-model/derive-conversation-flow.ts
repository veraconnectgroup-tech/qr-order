import type {
  GuestIntent,
  GuestIntentTransition,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

/** Canonical guest journey — Denis knows where the guest is (Prompt 92). */
export const CONVERSATION_FLOW: readonly GuestIntent[] = [
  "arrived",
  "exploring",
  "comparing",
  "decided",
  "ordering",
  "waiting_food",
  "eating",
  "finishing",
  "paying",
] as const;

const ABNORMAL_HINTS: Record<string, string> = {
  "eating→ordering": "Jos nesto uz obrok?",
  "finishing→ordering": "Jos nesto uz obrok?",
  "paying→ordering": "Jos nesto uz obrok?",
};

export function isAbnormalIntentTransition(
  from: GuestIntent,
  to: GuestIntent
): boolean {
  if (from === "eating" && to === "ordering") return true;
  if (from === "finishing" && to === "ordering") return true;
  if (from === "paying" && to === "ordering") return true;

  const fromIdx = CONVERSATION_FLOW.indexOf(from);
  const toIdx = CONVERSATION_FLOW.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return false;

  return toIdx < fromIdx - 1;
}

export function deriveConversationFlow(input: {
  intent: GuestIntent;
  intentTransitions: GuestIntentTransition[];
}): {
  nextLogicalStep: GuestIntent | null;
  abnormalTransition: GuestIntentTransition | null;
  hint: string | null;
} {
  const idx = CONVERSATION_FLOW.indexOf(input.intent);
  const nextLogicalStep =
    idx >= 0 && idx < CONVERSATION_FLOW.length - 1
      ? CONVERSATION_FLOW[idx + 1]!
      : null;

  const lastTransition =
    input.intentTransitions[input.intentTransitions.length - 1] ?? null;

  if (
    !lastTransition ||
    !isAbnormalIntentTransition(lastTransition.from, lastTransition.to)
  ) {
    return { nextLogicalStep, abnormalTransition: null, hint: null };
  }

  const hintKey = `${lastTransition.from}→${lastTransition.to}`;
  return {
    nextLogicalStep,
    abnormalTransition: lastTransition,
    hint: ABNORMAL_HINTS[hintKey] ?? null,
  };
}
