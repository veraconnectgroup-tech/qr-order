import {
  belief,
  CORE_BELIEF_KEYS,
} from "@/lib/denis/cognition/beliefs/belief-types";
import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";

function formatTopProductsBelief(
  rhythm: ResolvedRhythmContext
): string | null {
  if (!rhythm.topProductSummaries.length) return null;
  return rhythm.topProductSummaries
    .map((product) => `${product.name} (${product.sharePct}%)`)
    .join(", ");
}

/** ADR-042 C1 — rhythm priors as scored beliefs (shadow = observe only). */
export function compileRhythmBeliefs(
  rhythm: ResolvedRhythmContext | null | undefined
) {
  if (!rhythm?.active) {
    return [
      belief(
        CORE_BELIEF_KEYS.venueCurrentSlotStress,
        "normal",
        "default",
        0.7
      ),
      belief(
        CORE_BELIEF_KEYS.venueTypicalSessionMinutes,
        null,
        "default",
        0.5
      ),
      belief(CORE_BELIEF_KEYS.venueTopProducts, null, "default", 0.5),
    ];
  }

  const confidence = Math.max(0.55, rhythm.confidence);

  return [
    belief(
      CORE_BELIEF_KEYS.venueCurrentSlotStress,
      rhythm.currentSlotStress,
      "ops",
      confidence
    ),
    belief(
      CORE_BELIEF_KEYS.venueTypicalSessionMinutes,
      rhythm.typicalSessionMinutes,
      "ops",
      rhythm.typicalSessionMinutes != null ? confidence : 0.55
    ),
    belief(
      CORE_BELIEF_KEYS.venueTopProducts,
      formatTopProductsBelief(rhythm),
      "ops",
      rhythm.topProductSummaries.length > 0 ? confidence : 0.55
    ),
  ];
}
