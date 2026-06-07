import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestPriceAffinity } from "@/lib/denis/cognition/mental-model/mental-model-types";

/** Browse dwell heuristic — Phase 2 may use catalog priceBand on ingest. */
export function derivePriceAffinity(browse: GuestBrowseProfile): GuestPriceAffinity {
  if (browse.eventCount === 0) return "unknown";

  const avgDwell = browse.totalBrowseMs / browse.eventCount;
  if (avgDwell >= 7500) return "premium";
  if (avgDwell <= 2500) return "budget";
  return "mid";
}
