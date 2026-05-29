import { formatServeSize } from "@/lib/serve-size";
import { matchesT0SlotAnswer } from "@/lib/denis/cognition/tde/slot-response-match";
import type { PendingSlotKind } from "@/lib/denis/cognition/tde/turn-plan-types";

const VOLUME_IN_PHRASE =
  /\b(0[,.]33|0[,.]3|0[,.]5|0[,.]50?)\s*(l|liter|litre|litr)?\b/i;

const LARGE_LABEL =
  /\b(veliko|velika|velik|gro[sß]|gross|large|big|grande|grand)\b/i;
const SMALL_LABEL =
  /\b(malo|mala|mal|klein|small|petit|piccol)\b/i;
const MEDIUM_LABEL = /\b(srednj\w*|mittel|medium|regular)\b/i;

function parseVolume(value: string): number | null {
  const normalized = value.replace(/,/g, ".").replace(/l$/i, "").trim();
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function pickServeOptionByVolume(
  options: string[],
  target: number
): string | null {
  let best: { raw: string; delta: number } | null = null;
  for (const raw of options) {
    const vol =
      parseVolume(formatServeSize(raw)) ?? parseVolume(raw);
    if (vol === null) continue;
    const delta = Math.abs(vol - target);
    if (!best || delta < best.delta) {
      best = { raw, delta };
    }
  }
  return best?.raw ?? null;
}

function pickExtremeServeOption(
  options: string[],
  which: "large" | "small"
): string | null {
  if (!options.length) return null;

  const ranked = options
    .map((raw) => ({
      raw,
      vol: parseVolume(formatServeSize(raw)) ?? parseVolume(raw),
    }))
    .filter((entry) => entry.vol !== null)
    .sort((a, b) => a.vol! - b.vol!);

  if (ranked.length) {
    return which === "large"
      ? ranked[ranked.length - 1].raw
      : ranked[0].raw;
  }

  return which === "large" ? options[options.length - 1] : options[0];
}

/**
 * ADR-031 C2 — normalize guest slot replies (T0 + fuzzy typos/phrases).
 * Returns a string suitable for tryResolveQuickReply / matchServeSizeOption.
 */
export function normalizePendingSlotReply(
  slot: PendingSlotKind | string,
  message: string,
  options: string[] = []
): string {
  const text = message.trim();
  if (!text) return text;

  if (slot !== "serve_size") return text;

  const volumeMatch = text.match(VOLUME_IN_PHRASE);
  if (volumeMatch) {
    const token = volumeMatch[1].replace(",", ".");
    const target =
      token.startsWith("0.33") || token === "0.3" ? 0.3 : token.startsWith("0.5") ? 0.5 : parseFloat(token);
    if (Number.isFinite(target) && options.length) {
      const picked = pickServeOptionByVolume(options, target);
      if (picked) return picked;
    }
    return token.includes("5") ? "0.5" : token.includes("3") ? "0.3" : token;
  }

  const lower = text.toLowerCase().replace(/ß/g, "ss");
  if (LARGE_LABEL.test(lower)) {
    return pickExtremeServeOption(options, "large") ?? "velika";
  }
  if (SMALL_LABEL.test(lower)) {
    return pickExtremeServeOption(options, "small") ?? "mala";
  }
  if (MEDIUM_LABEL.test(lower)) {
    if (options.length >= 3) {
      const ranked = options
        .map((raw) => ({
          raw,
          vol: parseVolume(formatServeSize(raw)) ?? parseVolume(raw),
        }))
        .filter((entry) => entry.vol !== null)
        .sort((a, b) => a.vol! - b.vol!);
      if (ranked.length >= 3) {
        return ranked[Math.floor(ranked.length / 2)].raw;
      }
      return options[1];
    }
    return "srednja";
  }

  if (matchesT0SlotAnswer(slot, text)) return text;

  return text;
}
