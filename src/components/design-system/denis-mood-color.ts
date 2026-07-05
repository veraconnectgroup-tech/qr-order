/** Denis's brand ember (--qr-ember, #e85d04) interpolated toward alert red as urgency rises. */
const EMBER = { r: 0xe8, g: 0x5d, b: 0x04 };
const ALERT_RED = { r: 0xdc, g: 0x26, b: 0x26 };

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** intensity: 0 = calm ember orange, 1 = full alert red. Clamped. */
export function resolveDenisMoodColor(intensity: number, alpha = 1): string {
  const t = Math.min(1, Math.max(0, intensity));
  const r = lerp(EMBER.r, ALERT_RED.r, t);
  const g = lerp(EMBER.g, ALERT_RED.g, t);
  const b = lerp(EMBER.b, ALERT_RED.b, t);
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
