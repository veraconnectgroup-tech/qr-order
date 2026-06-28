import { invalidateRhythmPriorsCache } from "@/lib/denis/config/load-rhythm-priors";
import { parseLocationRhythmPriors, emptyLocationRhythmPriors } from "@/lib/denis/config/resolve-rhythm-priors";
import {
  accumulateVenueKnowledge,
  mergeRhythmPriorsIntoVenueKnowledge,
} from "@/lib/denis/learning/venue-knowledge-accumulator";
import {
  attachVenueKnowledgeToPriors,
  parseVenueKnowledgeFromPriors,
} from "@/lib/denis/learning/venue-knowledge-storage";
import type { VenueKnowledgeOrderRow } from "@/lib/denis/learning/venue-knowledge-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOOKBACK_DAYS = 180;
const MAX_ORDER_ROWS = 12_000;

export async function fetchVenueKnowledgeOrderRows(
  admin: SupabaseClient,
  locationId: string
): Promise<VenueKnowledgeOrderRow[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
      session_id,
      created_at,
      order_items (
        product_id,
        product_name,
        notes,
        menu_section,
        products ( drink_family, food_tags, prep_station )
      )
    `
    )
    .eq("location_id", locationId)
    .eq("status", "delivered")
    .not("session_id", "is", null)
    .gte("created_at", since)
    .limit(MAX_ORDER_ROWS);

  if (error) {
    throw new Error(error.message);
  }

  const rows: VenueKnowledgeOrderRow[] = [];
  for (const order of (data ?? []) as unknown as Array<{
    session_id: string | null;
    created_at: string;
    order_items: Array<{
      product_id: string | null;
      product_name: string;
      notes: string | null;
      menu_section: string | null;
      products:
        | {
            drink_family: string | null;
            food_tags: string[] | null;
            prep_station: string | null;
          }
        | Array<{
            drink_family: string | null;
            food_tags: string[] | null;
            prep_station: string | null;
          }>
        | null;
    }> | null;
  }>) {
    const tableSessionId = order.session_id?.trim();
    if (!tableSessionId) continue;
    for (const item of order.order_items ?? []) {
      const productId = item.product_id?.trim();
      const productName = item.product_name?.trim();
      if (!productId || !productName) continue;
      const productMeta = Array.isArray(item.products)
        ? (item.products[0] ?? null)
        : (item.products ?? null);
      rows.push({
        tableSessionId,
        productId,
        productName,
        menuSection: item.menu_section,
        drinkFamily: productMeta?.drink_family ?? null,
        foodTags: productMeta?.food_tags?.filter(Boolean) ?? [],
        createdAt: order.created_at,
        notes: item.notes,
      });
    }
  }

  return rows;
}

export async function rollupVenueKnowledgeForLocation(
  admin: SupabaseClient,
  input: { locationId: string; orgId: string; sessionLanguages?: string[] }
): Promise<{ orderRows: number }> {
  const orderRows = await fetchVenueKnowledgeOrderRows(admin, input.locationId);

  const { data: priorsRow } = await admin
    .from("location_rhythm_priors" as never)
    .select("priors")
    .eq("location_id", input.locationId)
    .maybeSingle();

  const priors =
    parseLocationRhythmPriors(
      (priorsRow as { priors?: unknown } | null)?.priors
    ) ?? emptyLocationRhythmPriors();

  let snapshot = accumulateVenueKnowledge({
    orderRows,
    sessionLanguages: input.sessionLanguages,
  });
  snapshot = mergeRhythmPriorsIntoVenueKnowledge(snapshot, priors);

  const nextPriors = attachVenueKnowledgeToPriors(priors, snapshot);

  const { error } = await admin
    .from("location_rhythm_priors" as never)
    .upsert(
      {
        location_id: input.locationId,
        org_id: input.orgId,
        priors: nextPriors,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id" }
    );

  if (error) {
    throw new Error(error.message);
  }

  await invalidateRhythmPriorsCache(input.locationId);
  return { orderRows: orderRows.length };
}

export async function loadVenueKnowledgeForLocation(
  admin: SupabaseClient,
  locationId: string
) {
  const { data, error } = await admin
    .from("location_rhythm_priors" as never)
    .select("priors, updated_at")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) {
    logger.warn("venue knowledge load failed", {
      locationId,
      error: error.message,
    });
    return null;
  }

  const priors = (data as { priors?: unknown; updated_at?: string } | null)?.priors;
  const snapshot = parseVenueKnowledgeFromPriors(priors);
  if (!snapshot) return null;

  return {
    snapshot,
    updatedAt:
      (data as { updated_at?: string } | null)?.updated_at ??
      snapshot.computedAt,
  };
}
