/** Client-safe bus-table helpers (no server / push imports). */

export function minutesSincePaid(paidAt: string, nowMs: number = Date.now()): number {
  const ts = Date.parse(paidAt);
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.floor((nowMs - ts) / 60_000));
}
