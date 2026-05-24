const MAX_DELAY_SECONDS = 300;
const BASE_DELAY_SECONDS = 5;

/** Exponential backoff: min(300s, 2^attempts * 5s) — ADR-001 §6.2 */
export function computeOutboxRetryDelaySeconds(attempts: number): number {
  const exponent = Math.max(0, attempts);
  const delay = Math.pow(2, exponent) * BASE_DELAY_SECONDS;
  return Math.min(MAX_DELAY_SECONDS, delay);
}

export function computeOutboxNextRetryAt(attempts: number, from = new Date()): Date {
  const delayMs = computeOutboxRetryDelaySeconds(attempts) * 1000;
  return new Date(from.getTime() + delayMs);
}
