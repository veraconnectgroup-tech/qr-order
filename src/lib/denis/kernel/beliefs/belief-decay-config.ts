export type BeliefDecayCategory =
  | "allergies"
  | "intent"
  | "language"
  | "preference"
  | "default";

/** Per-category decay windows for belief confidence propagation (Prompt 91). */
export type BeliefDecayConfig = {
  decayWindowsMs: Record<BeliefDecayCategory, number>;
  minConfidence: number;
};

export const DEFAULT_BELIEF_DECAY_CONFIG: BeliefDecayConfig = {
  decayWindowsMs: {
    allergies: Number.POSITIVE_INFINITY,
    intent: 5 * 60 * 1000,
    language: 30 * 60 * 1000,
    preference: 10 * 60 * 1000,
    default: 10 * 60 * 1000,
  },
  minConfidence: 0.5,
};
