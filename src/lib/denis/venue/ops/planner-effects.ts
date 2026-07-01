import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import {
  parseEventConfig,
  resolveEventEffects,
  resolveEventPhase,
} from "@/lib/denis/venue/ops/event-mode";

/** Map venue ops → kernel planner + narration effects (M13). */
export function deriveOpsPlannerEffects(
  ops: VenueOpsBeliefs,
  config: Pick<ConciergeConfig, "ops">
): OpsPlannerEffects {
  const rushSkip =
    config.ops.rushSkipUpsell &&
    (ops.operatingMode === "rush" || ops.operatingMode === "kitchen_closed");
  const kdsSkip =
    config.ops.kdsStressSkipUpsell && ops.kdsStress === "high";

  const skipUpsell = rushSkip || kdsSkip;
  const suppressProactiveNudges =
    ops.operatingMode === "rush" || ops.kdsStress === "high";

  let empathyNote: string | null = null;
  if (ops.operatingMode === "rush") {
    empathyNote = "Kuhinja je imala puno posla — držimo odgovore kratko.";
  } else if (ops.kdsStress === "high") {
    empathyNote = "Kuhinja je pod pritiskom — hvala na strpljenju.";
  }

  const guestSafeStaffHint =
    config.ops.staffHintsEnabled &&
    ops.staffHint?.visibility === "guest_safe"
      ? ops.staffHint.text
      : null;

  const base: OpsPlannerEffects = {
    skipUpsell,
    shortenReplies: skipUpsell,
    empathyNote,
    guestSafeStaffHint,
    suppressProactiveNudges: suppressProactiveNudges || undefined,
  };

  const event = parseEventConfig(ops.eventConfig);
  if (ops.operatingMode === "event" && event) {
    const eventPhase = resolveEventPhase(event);
    const eventEffects = resolveEventEffects(event, eventPhase);
    return {
      ...base,
      skipUpsell: base.skipUpsell || eventEffects.skipUpsell,
      shortenReplies: base.shortenReplies || eventEffects.shortenReplies,
      presetMenuOnly: eventEffects.presetMenuOnly,
      presetProductIds: event.presetProductIds ?? [],
      suppressProactiveNudges: eventEffects.suppressProactiveNudges,
      drinkPromptOnly: eventEffects.drinkPromptOnly,
      groupBillEnabled: eventEffects.groupBillEnabled,
      batchOrderEnabled: eventEffects.batchOrderEnabled,
      eventPhase,
    };
  }

  return base;
}

export function unavailableProductNamesInDraft(
  draftItems: Array<{ productId: string; productName: string }>,
  unavailableProductIds: string[]
): string[] {
  const blocked = new Set(unavailableProductIds);
  const names: string[] = [];
  for (const line of draftItems) {
    if (!blocked.has(line.productId)) continue;
    const name = line.productName.trim();
    if (name) names.push(name);
  }
  return [...new Set(names)];
}
