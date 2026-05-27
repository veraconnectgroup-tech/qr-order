import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";

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

  return {
    skipUpsell,
    shortenReplies: skipUpsell,
    empathyNote,
    guestSafeStaffHint,
  };
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
