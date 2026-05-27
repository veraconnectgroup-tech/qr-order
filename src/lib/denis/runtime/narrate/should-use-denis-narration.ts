import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";

/** M21/M27 — Denis T3 narrator for guests on Denis path (not legacy cohort). */
export function shouldUseDenisNarration(
  config: ConciergeConfig,
  rolloutMode: ConciergeRolloutMode,
  options?: { guestUsesLegacy?: boolean }
): boolean {
  if (options?.guestUsesLegacy) return false;
  if (!config.llm.narrateWithLlm) return false;
  return rolloutMode === "denis_only" || rolloutMode === "canary";
}
