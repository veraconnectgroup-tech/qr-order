import {
  emptyLocationRhythmPriors,
  parseLocationRhythmPriors,
  servicePeriodFromHour,
} from "@/lib/denis/config/resolve-rhythm-priors";
import { invalidateRhythmPriorsCache } from "@/lib/denis/config/load-rhythm-priors";
import type {
  LocationRhythmPriorsJson,
  RhythmSlotPrior,
  RhythmSlotTopProduct,
} from "@/lib/denis/config/rhythm-prior-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const EWMA_ALPHA = 0.15;

export type SessionCompletedRollupPayload = {
  slotKey: string;
  localDow: number;
  localHour: number;
  durationMin: number;
  dessertDelayMin: number | null;
  revenue: number;
  topProducts: RhythmSlotTopProduct[];
  servicePeriod: string;
};

function ewma(previous: number | null, sample: number): number {
  if (previous == null || !Number.isFinite(previous)) {
    return sample;
  }
  return previous + EWMA_ALPHA * (sample - previous);
}

function mergeTopProducts(
  existing: RhythmSlotTopProduct[],
  incoming: RhythmSlotTopProduct[]
): RhythmSlotTopProduct[] {
  const counts = new Map<string, RhythmSlotTopProduct>();

  for (const product of [...existing, ...incoming]) {
    const key = product.productId ?? product.name;
    const current = counts.get(key);
    if (current) {
      current.count += product.count;
    } else {
      counts.set(key, { ...product });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export function applySessionCompletedToRhythmPriors(
  priors: LocationRhythmPriorsJson,
  payload: SessionCompletedRollupPayload
): LocationRhythmPriorsJson {
  const next = structuredClone(priors);
  const existing = next.slots[payload.slotKey];

  const slot: RhythmSlotPrior = existing ?? {
    sampleSessions: 0,
    sessionDurationP50Min: null,
    dessertDelayP50Min: null,
    revenueEma: null,
    topProducts: [],
    servicePeriod: servicePeriodFromHour(payload.localHour),
  };

  slot.sampleSessions += 1;
  slot.sessionDurationP50Min = ewma(
    slot.sessionDurationP50Min,
    payload.durationMin
  );

  if (payload.dessertDelayMin != null) {
    slot.dessertDelayP50Min = ewma(
      slot.dessertDelayP50Min,
      payload.dessertDelayMin
    );
  }

  if (payload.revenue > 0) {
    slot.revenueEma = ewma(slot.revenueEma, payload.revenue);
  }

  slot.topProducts = mergeTopProducts(slot.topProducts, payload.topProducts);
  slot.servicePeriod =
    payload.servicePeriod === "breakfast" ||
    payload.servicePeriod === "lunch" ||
    payload.servicePeriod === "afternoon" ||
    payload.servicePeriod === "dinner" ||
    payload.servicePeriod === "late"
      ? payload.servicePeriod
      : servicePeriodFromHour(payload.localHour);

  next.slots[payload.slotKey] = slot;
  return next;
}

export function parseSessionCompletedRollupPayload(
  payload: Record<string, unknown>
): SessionCompletedRollupPayload | null {
  const slotKey =
    typeof payload.slotKey === "string" ? payload.slotKey.trim() : "";
  if (!slotKey) return null;

  const localDow =
    typeof payload.localDow === "number" ? payload.localDow : Number(payload.localDow);
  const localHour =
    typeof payload.localHour === "number"
      ? payload.localHour
      : Number(payload.localHour);
  const durationMin =
    typeof payload.durationMin === "number"
      ? payload.durationMin
      : Number(payload.durationMin);
  const revenue =
    typeof payload.revenue === "number" ? payload.revenue : Number(payload.revenue);

  if (
    !Number.isFinite(localDow) ||
    !Number.isFinite(localHour) ||
    !Number.isFinite(durationMin)
  ) {
    return null;
  }

  const topProducts = Array.isArray(payload.topProducts)
    ? payload.topProducts
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const product = row as Record<string, unknown>;
          const name =
            typeof product.name === "string" ? product.name.trim() : "";
          if (!name) return null;
          const count =
            typeof product.count === "number"
              ? product.count
              : Number(product.count);
          if (!Number.isFinite(count) || count <= 0) return null;
          return {
            productId:
              typeof product.productId === "string" ? product.productId : null,
            name,
            count,
          };
        })
        .filter((row): row is RhythmSlotTopProduct => row != null)
    : [];

  return {
    slotKey,
    localDow,
    localHour,
    durationMin,
    dessertDelayMin:
      typeof payload.dessertDelayMin === "number"
        ? payload.dessertDelayMin
        : payload.dessertDelayMin == null
          ? null
          : Number(payload.dessertDelayMin),
    revenue: Number.isFinite(revenue) ? revenue : 0,
    topProducts,
    servicePeriod:
      typeof payload.servicePeriod === "string"
        ? payload.servicePeriod
        : servicePeriodFromHour(localHour),
  };
}

export async function upsertVenueRhythmPriors(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const rollupPayload = parseSessionCompletedRollupPayload(input.payload);
  if (!rollupPayload) {
    return;
  }

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

  const updated = applySessionCompletedToRhythmPriors(current, rollupPayload);

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
