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

/** Raw {r,g,b} for the mood color — for blending shades in JS instead of relying on CSS color-mix() support. */
export function resolveDenisMoodRgb(intensity: number): {
  r: number;
  g: number;
  b: number;
} {
  const t = Math.min(1, Math.max(0, intensity));
  return {
    r: lerp(EMBER.r, ALERT_RED.r, t),
    g: lerp(EMBER.g, ALERT_RED.g, t),
    b: lerp(EMBER.b, ALERT_RED.b, t),
  };
}

/**
 * Blends a base color toward the mood color as intensity rises — orb highlights
 * shift from white cloud to full ember/red at max urgency.
 */
export function mixTowardMoodColor(
  base: { r: number; g: number; b: number },
  intensity: number,
  alpha = 1
): string {
  const t = Math.min(1, Math.max(0, intensity));
  const r = lerp(base.r, lerp(EMBER.r, ALERT_RED.r, t), t);
  const g = lerp(base.g, lerp(EMBER.g, ALERT_RED.g, t), t);
  const b = lerp(base.b, lerp(EMBER.b, ALERT_RED.b, t), t);
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Blends the mood color toward white by a fixed percentage (not intensity-scaled) — e.g. mixWithWhite(rgb, 55) = 55% tint + 45% white. */
export function mixWithWhite(
  rgb: { r: number; g: number; b: number },
  pct: number
): string {
  const t = Math.min(1, Math.max(0, pct / 100));
  const r = lerp(255, rgb.r, t);
  const g = lerp(255, rgb.g, t);
  const b = lerp(255, rgb.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}
