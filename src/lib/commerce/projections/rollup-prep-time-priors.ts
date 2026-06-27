import { collectPrepTimeFacts } from "@/lib/commerce/projections/collect-prep-time-facts";
import type { PrepTimeFact } from "@/lib/commerce/projections/collect-prep-time-facts";
import {
  emptyLocationPrepTimePriorsJson,
  locationPrepTimePriorsFromJson,
  locationPrepTimePriorsToJson,
  parseLocationPrepTimePriors,
  type LocationPrepTimePriorsJson,
  type PrepStationPrior,
  type PrepTimePrior,
} from "@/lib/denis/config/prep-time-priors";
import {
  emptyLocationRhythmPriors,
  parseLocationRhythmPriors,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import { invalidateRhythmPriorsCache } from "@/lib/denis/config/load-rhythm-priors";
import type { PrepTimeOrderRow } from "@/lib/commerce/projections/collect-prep-time-facts";
import type { SupabaseClient } from "@supabase/supabase-js";

const EWMA_ALPHA = 0.15;
const DEFAULT_RUSH_MULTIPLIER = 1.4;

function ewma(previous: number | null, sample: number): number {
  if (previous == null || !Number.isFinite(previous)) {
    return sample;
  }
  return previous + EWMA_ALPHA * (sample - previous);
}

function updateRushMultiplier(
  previous: number,
  sample: number,
  baseline: number
): number {
  if (baseline <= 0) return previous;
  const observed = Math.max(1, sample / baseline);
  return ewma(previous, observed);
}

function prepTimeJsonFromRhythmPriors(
  priors: LocationRhythmPriorsJson
): LocationPrepTimePriorsJson {
  return priors.prepTime ?? emptyLocationPrepTimePriorsJson();
}

function withPrepTimeJson(
  priors: LocationRhythmPriorsJson,
  prepTime: LocationPrepTimePriorsJson
): LocationRhythmPriorsJson {
  return {
    ...priors,
    prepTime,
  };
}

function updateProductPrior(
  existing: PrepTimePrior | undefined,
  fact: PrepTimeFact
): PrepTimePrior {
  const prior = existing ?? {
    productId: fact.productId,
    p50Minutes: fact.prepMinutes,
    p90Minutes: fact.prepMinutes,
    sampleCount: 0,
    rushMultiplier: DEFAULT_RUSH_MULTIPLIER,
  };

  const nextP50 = ewma(prior.p50Minutes, fact.prepMinutes);
  const nextP90 = ewma(
    prior.p90Minutes,
    Math.max(fact.prepMinutes, prior.p90Minutes ?? fact.prepMinutes)
  );

  let rushMultiplier = prior.rushMultiplier;
  if (fact.isRush && prior.p50Minutes > 0) {
    rushMultiplier = updateRushMultiplier(
      prior.rushMultiplier,
      fact.prepMinutes,
      prior.p50Minutes
    );
  }

  return {
    productId: fact.productId,
    p50Minutes: Math.round(nextP50 * 10) / 10,
    p90Minutes: Math.round(nextP90 * 10) / 10,
    sampleCount: prior.sampleCount + 1,
    rushMultiplier: Math.round(rushMultiplier * 100) / 100,
  };
}

function updateStationPrior(
  existing: PrepStationPrior | undefined,
  fact: PrepTimeFact
): PrepStationPrior {
  const prior = existing ?? {
    p50: fact.prepMinutes,
    p90: fact.prepMinutes,
    samples: 0,
    rushMultiplier: DEFAULT_RUSH_MULTIPLIER,
  };

  const nextP50 = ewma(prior.p50, fact.prepMinutes);
  const nextP90 = ewma(
    prior.p90,
    Math.max(fact.prepMinutes, prior.p90 ?? fact.prepMinutes)
  );

  let rushMultiplier = prior.rushMultiplier;
  if (fact.isRush && prior.p50 > 0) {
    rushMultiplier = updateRushMultiplier(
      prior.rushMultiplier,
      fact.prepMinutes,
      prior.p50
    );
  }

  return {
    p50: Math.round(nextP50 * 10) / 10,
    p90: Math.round(nextP90 * 10) / 10,
    samples: prior.samples + 1,
    rushMultiplier: Math.round(rushMultiplier * 100) / 100,
  };
}

export function applyPrepTimeFactsToPriors(
  priors: LocationRhythmPriorsJson,
  facts: PrepTimeFact[]
): LocationRhythmPriorsJson {
  if (!facts.length) return priors;

  const prepJson = prepTimeJsonFromRhythmPriors(priors);
  const runtime = locationPrepTimePriorsFromJson(prepJson);

  for (const fact of facts) {
    runtime.byProduct.set(
      fact.productId,
      updateProductPrior(runtime.byProduct.get(fact.productId), fact)
    );
    runtime.byStation.set(
      fact.station,
      updateStationPrior(runtime.byStation.get(fact.station), fact)
    );
  }

  runtime.updatedAt = new Date().toISOString();
  return withPrepTimeJson(priors, locationPrepTimePriorsToJson(runtime));
}

export async function upsertPrepTimePriorsFromOrderDelivered(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    orderId: string;
  }
): Promise<void> {
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      `
      id,
      status,
      created_at,
      accepted_at,
      preparing_at,
      delivered_at,
      order_items (product_id, product_name, menu_section)
    `
    )
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return;
  }

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("timezone, denis_operating_mode")
    .eq("id", input.locationId)
    .maybeSingle();

  if (locationError || !location) {
    return;
  }

  const locationRow = location as {
    timezone: string | null;
    denis_operating_mode: string | null;
  };

  const facts = collectPrepTimeFacts(order as PrepTimeOrderRow, {
      locationId: input.locationId,
      timezone: locationRow.timezone?.trim() || "Europe/Berlin",
      isRush: locationRow.denis_operating_mode === "rush",
    });

  if (!facts.length) return;

  const { data: existing, error: readError } = await admin
    .from("location_rhythm_priors" as never)
    .select("priors")
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const current =
    parseLocationRhythmPriors((existing as { priors?: unknown } | null)?.priors) ??
    emptyLocationRhythmPriors();

  const updated = applyPrepTimeFactsToPriors(current, facts);

  const { error: upsertError } = await admin
    .from("location_rhythm_priors" as never)
    .upsert(
      {
        location_id: input.locationId,
        org_id: input.orgId,
        priors: updated,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  await invalidateRhythmPriorsCache(input.locationId);
}

export function prepTimePriorsFromRhythmJson(
  priors: LocationRhythmPriorsJson | null | undefined
) {
  if (!priors?.prepTime) return null;
  const parsed = parseLocationPrepTimePriors(priors.prepTime);
  if (!parsed) return null;
  return locationPrepTimePriorsFromJson(parsed);
}
