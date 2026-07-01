import { parseLearnedBasketPairs } from "@/lib/denis/config/basket-pair-analysis";
import type { LearnedBasketPairsJson } from "@/lib/denis/config/basket-pair-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadLearnedBasketPairsForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<LearnedBasketPairsJson> {
  const { data, error } = await admin
    .from("location_rhythm_priors" as never)
    .select("learned_basket_pairs")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) {
    logger.warn("learned_basket_pairs load failed", {
      locationId,
      error: error.message,
    });
    return { version: 1, pairs: [] };
  }

  return (
    parseLearnedBasketPairs(
      (data as { learned_basket_pairs?: unknown } | null)?.learned_basket_pairs
    ) ?? { version: 1, pairs: [] }
  );
}
