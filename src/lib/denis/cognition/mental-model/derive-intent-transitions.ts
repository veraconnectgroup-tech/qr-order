import type {
  GuestIntent,
  GuestIntentTransition,
  PreviousMentalFoldContext,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

const MAX_INTENT_TRANSITIONS = 8;

/** Rolling intent transition log — last 8 shifts (ADR-038 Val D). */
export function deriveIntentTransitions(input: {
  intent: GuestIntent;
  previous: PreviousMentalFoldContext | null | undefined;
  now: number;
}): GuestIntentTransition[] {
  const previousTransitions = input.previous?.intentTransitions ?? [];

  if (!input.previous || input.previous.intent === input.intent) {
    return previousTransitions.slice(-MAX_INTENT_TRANSITIONS);
  }

  const transition: GuestIntentTransition = {
    from: input.previous.intent,
    to: input.intent,
    at: input.now,
    durationMs: Math.max(0, input.now - input.previous.computedAt),
  };

  return [...previousTransitions, transition].slice(-MAX_INTENT_TRANSITIONS);
}
