import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestScrollPosture } from "@/lib/denis/cognition/mental-model/mental-model-types";

export function emptyGuestScrollPosture(): GuestScrollPosture {
  return {
    latestIntent: null,
    focusedCategory: null,
    searching: false,
    deferUpsell: false,
    readyForRecommendation: false,
  };
}

/** Scroll telemetry → guest posture for pace, intent, and proactive gating. */
export function deriveScrollPosture(browse: GuestBrowseProfile): GuestScrollPosture {
  const latest = browse.scrollIntents.at(-1);
  if (!latest) return emptyGuestScrollPosture();

  return {
    latestIntent: latest.intent,
    focusedCategory: latest.categoryLabel ?? null,
    searching: latest.intent === "fast_search",
    deferUpsell: latest.intent === "slow_category",
    readyForRecommendation: latest.intent === "reached_bottom",
  };
}
