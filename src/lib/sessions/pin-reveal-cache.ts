/** Short-lived plain PIN reveal after staff approval (not persisted in DB). */
const cache = new Map<string, { pin: string; expiresAt: number }>();

const TTL_MS = 10 * 60 * 1000;

export function storePinReveal(orderId: string, pin: string) {
  if (!pin) return;
  cache.set(orderId, { pin, expiresAt: Date.now() + TTL_MS });
}

export function consumePinReveal(orderId: string): string | null {
  const entry = cache.get(orderId);
  if (!entry) return null;
  cache.delete(orderId);
  if (Date.now() > entry.expiresAt) return null;
  return entry.pin;
}
