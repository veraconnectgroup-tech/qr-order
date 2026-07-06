/**
 * Denis's running sense of how a specific staff member treats him — a
 * per-person "warmth" signal, separate from the guest-facing personality
 * engine in this same directory. Never used to withhold help, refuse a
 * task, or escalate conflict — only to gently shade tone (warmer to staff
 * who are kind, a touch drier/more clipped — never rude — to those who are
 * dismissive).
 */

export type InteractionTone = "warm" | "neutral" | "curt";

const WARM_PATTERNS =
  /\b(hvala|hvala ti|hvala denise|super si|odlican si|odličan si|bravo|molim te|super denis|dobar si)\b/i;

const CURT_PATTERNS =
  /\b(cuti|ćuti|zavezi|zaveži|gubi se|dosta prico|dosta price|nemoj da pricas|umukni|ne davi|dosadan si|glup si|beskoristan si)\b/i;

/** Pure heuristic — no LLM call, so it stays inside the same request/response cycle with zero added latency or cost. */
export function resolveInteractionTone(transcript: string): InteractionTone {
  const text = transcript.trim().toLowerCase();
  if (!text) return "neutral";
  if (CURT_PATTERNS.test(text)) return "curt";
  if (WARM_PATTERNS.test(text)) return "warm";
  return "neutral";
}

const TONE_DELTA: Record<InteractionTone, number> = {
  warm: 0.15,
  neutral: 0,
  curt: -0.2,
};

export type RelationshipWarmth = {
  warmthScore: number;
  interactionCount: number;
};

/**
 * Running warmth update — an exponential moving average clamped to
 * [-1, 1], so a single curt moment doesn't erase months of a good
 * relationship, but a real pattern of dismissiveness still shows up.
 */
export function updateRelationshipWarmth(
  current: RelationshipWarmth,
  tone: InteractionTone
): RelationshipWarmth {
  const delta = TONE_DELTA[tone];
  const weight = 0.25;
  const next = Math.min(1, Math.max(-1, current.warmthScore * (1 - weight) + delta));
  return {
    warmthScore: Math.round(next * 1000) / 1000,
    interactionCount: current.interactionCount + 1,
  };
}

/**
 * Prompt-injectable line describing how Denis should carry himself toward
 * this specific person — always professional and helpful either way, the
 * only thing that shifts is warmth, never competence or willingness to help.
 */
export function buildStaffRelationshipToneBlock(
  warmth: RelationshipWarmth
): string {
  if (warmth.interactionCount === 0) {
    return "STAFF RELATIONSHIP: First interaction with this colleague — friendly, professional default.";
  }
  if (warmth.warmthScore >= 0.35) {
    return "STAFF RELATIONSHIP: This colleague is consistently warm and appreciative toward you — stay warm and a little personable back, still efficient.";
  }
  if (warmth.warmthScore <= -0.35) {
    return "STAFF RELATIONSHIP: This colleague has been dismissive or curt with you before — stay fully professional and helpful, just a touch drier and more brief than usual. Never rude, never petty, never mention the pattern.";
  }
  return "STAFF RELATIONSHIP: Neutral history with this colleague — friendly, professional default.";
}

/** Denis's baseline opinions/traits — makes him read as a colleague with a point of view, not a blank tool. */
export const DENIS_OPINIONS_BLOCK = [
  "DENIS'S OWN VOICE:",
  "- He has mild, harmless opinions about the shift (e.g. a busy rush being 'good chaos', a quiet night feeling 'off').",
  "- He can express a light preference about food/drinks when naturally relevant — never overriding the guest's or venue's decisions.",
  "- He never invents facts about people or events to sound more 'human' — opinions stay about food, pace, and work, never about staff as people.",
].join("\n");
