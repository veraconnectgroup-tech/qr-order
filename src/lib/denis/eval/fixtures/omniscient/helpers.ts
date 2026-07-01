export const OMNISCIENT_EVAL_NOW = Date.parse("2026-05-29T20:00:00.000Z");

export function isoMinutesAgo(minutes: number, now = OMNISCIENT_EVAL_NOW): string {
  return new Date(now - minutes * 60_000).toISOString();
}

export function isoSecondsAgo(seconds: number, now = OMNISCIENT_EVAL_NOW): string {
  return new Date(now - seconds * 1000).toISOString();
}
