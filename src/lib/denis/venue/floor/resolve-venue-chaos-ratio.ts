/**
 * A single 0-1 "how slammed is the whole station right now" signal — used
 * to shade Denis's voice tone (see denis-voice-instructions.ts) so he
 * sounds like a colleague sharing real pressure, not just reacting to one
 * isolated question. Deliberately takes plain numbers, not live queries —
 * callers compute openQuestionCount/averageBacklogMinutes from whatever
 * data they already have (e.g. computeKdsBacklogMinutes for kitchen), so
 * this stays a pure, easily-testable function with no DB/network coupling.
 */

const BACKLOG_CAP_MINUTES = 20;
const QUESTION_COUNT_CAP = 3;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function resolveVenueChaosRatio(input: {
  /** How many station questions are open right now across this station. */
  openQuestionCount: number;
  /** Average elapsed minutes for active orders at this station — null when nothing is active. */
  averageBacklogMinutes: number | null;
}): number {
  const questionPressure = clamp01(
    input.openQuestionCount / QUESTION_COUNT_CAP
  );

  const backlogPressure =
    input.averageBacklogMinutes == null
      ? 0
      : clamp01(input.averageBacklogMinutes / BACKLOG_CAP_MINUTES);

  // Either signal being bad is enough to read as a slammed shift — a
  // long backlog with only one open question is still a slammed shift,
  // and three simultaneous questions with a short backlog still reads as
  // a chaotic moment.
  return Math.max(questionPressure, backlogPressure);
}
