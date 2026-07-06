/**
 * Composes a single natural-language delivery instruction for Denis's TTS
 * voice (gpt-4o-mini-tts's `instructions` field) out of three independent
 * signals, rather than a fixed lookup table of moods:
 *
 * 1. Question urgency — how close THIS question is to timing out / how
 *    overdue the order behind it is (0 = just asked, 1 = critical).
 * 2. Venue chaos — how slammed the station is overall right now (0 = calm
 *    shift, 1 = the whole board is backed up), independent of this one
 *    question.
 * 3. Relationship warmth — this specific person's running history with
 *    Denis (see staff-relationship-engine.ts), -1 = has been dismissive,
 *    1 = consistently kind.
 *
 * Composable by design: adding a fourth signal later means adding one more
 * clause-resolver, not rewriting a mood switch statement. The voice
 * identity itself never changes — only delivery (pace, warmth, tension).
 */

export type DenisVoiceMoodInput = {
  /** 0-1, clamped. */
  urgencyRatio: number;
  /** 0-1, clamped. Defaults to 0 (calm) when unknown. */
  venueChaosRatio?: number;
  /** -1 to 1, clamped. Defaults to 0 (neutral/unknown relationship). */
  relationshipWarmth?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveUrgencyClause(urgencyRatio: number): string {
  if (urgencyRatio >= 0.75) {
    return "Speak with clear tension and urgency, like someone who has been trying to get attention for a while and is now stressed — never hostile, never rude, just genuinely pressed for time.";
  }
  if (urgencyRatio >= 0.4) {
    return "Speak with a bit more urgency and pace than normal, still warm and respectful.";
  }
  return "Speak calmly and warmly, unhurried.";
}

function resolveChaosClause(venueChaosRatio: number): string | null {
  if (venueChaosRatio >= 0.6) {
    return "The whole station has been slammed for a while — let a slight undercurrent of shared pressure come through, like a colleague who's in the weeds with everyone else, not just this one question.";
  }
  return null;
}

function resolveRelationshipClause(relationshipWarmth: number): string | null {
  if (relationshipWarmth >= 0.35) {
    return "You get along well with this colleague — let a little genuine warmth and familiarity come through.";
  }
  if (relationshipWarmth <= -0.35) {
    return "This colleague has been dismissive with you before — stay fully professional and helpful, just a touch more clipped and formal than usual. Never cold, never petty, never mention it.";
  }
  return null;
}

/** Builds the full instruction string for a given mood input. Pure — no I/O, easy to test. */
export function resolveDenisVoiceInstructions(input: DenisVoiceMoodInput): string {
  const urgencyRatio = clamp(input.urgencyRatio, 0, 1);
  const venueChaosRatio = clamp(input.venueChaosRatio ?? 0, 0, 1);
  const relationshipWarmth = clamp(input.relationshipWarmth ?? 0, -1, 1);

  const clauses = [
    resolveUrgencyClause(urgencyRatio),
    resolveChaosClause(venueChaosRatio),
    resolveRelationshipClause(relationshipWarmth),
  ].filter((clause): clause is string => clause != null);

  return clauses.join(" ");
}
