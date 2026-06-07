import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type RhythmMode = "off" | "shadow" | "enforce";

export function resolveRhythmMode(config: ConciergeConfig): RhythmMode {
  if (!config.rhythm.enabled) return "off";
  return config.rhythm.mode;
}

export function isRhythmActive(config: ConciergeConfig): boolean {
  return resolveRhythmMode(config) !== "off";
}
