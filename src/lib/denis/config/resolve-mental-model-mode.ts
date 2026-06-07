import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type MentalModelMode = "off" | "shadow" | "enforce";

/** Resolve rollout mode — `enabled: true` maps to enforce when mode is off (legacy). */
export function resolveMentalModelMode(config: ConciergeConfig): MentalModelMode {
  const { mode, enabled } = config.mentalModel;
  if (mode === "shadow" || mode === "enforce") return mode;
  return enabled ? "enforce" : "off";
}
