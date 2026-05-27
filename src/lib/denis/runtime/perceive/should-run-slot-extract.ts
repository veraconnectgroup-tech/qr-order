import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";

/** Run T2 perceive when enabled and T0 did not handle the utterance (M22). */
export function shouldRunSlotExtract(
  config: ConciergeConfig,
  reflexTurn: ReflexTurnResult
): boolean {
  if (!config.ordering.slotExtractEnabled) return false;
  if (reflexTurn.usedT0) return false;
  if (reflexTurn.reflex?.intent === "CONFIRM") return false;
  if (reflexTurn.reflex?.intent === "DECLINE") return false;
  if (reflexTurn.reflex?.intent === "DONE") return false;
  return true;
}
