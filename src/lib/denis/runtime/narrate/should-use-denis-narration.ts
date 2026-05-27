import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";

/** M21 — Denis T3 narrator replaces legacy chat text for guests. */
export function shouldUseDenisNarration(
  config: ConciergeConfig,
  rolloutMode: ConciergeRolloutMode
): boolean {
  return rolloutMode === "denis_only" && config.llm.narrateWithLlm;
}
