import { COMMERCE_EVENT_TYPES } from "@/lib/commerce/event-types";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

type JsonMap = Record<string, number>;

function bumpMap(map: JsonMap, key: string, delta = 1): JsonMap {
  const next = { ...map };
  next[key] = (next[key] ?? 0) + delta;
  return next;
}

export function metricDateFromIso(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

export type AnticipationRollupInput = {
  orgId: string;
  locationId: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export function anticipationRollupDelta(input: AnticipationRollupInput): {
  metricDate: string;
  nudgeImpressions: number;
  offerConversions: number;
  conversionLagSeconds: number;
  nudgeDeclined: number;
  nudgeIgnored: number;
  nudgeExpired: number;
  byNudgeKind: JsonMap;
  byOfferResolution: JsonMap;
  byOutcome: JsonMap;
  byTimingKind: JsonMap;
} {
  const metricDate = metricDateFromIso(input.createdAt);

  if (input.eventType === COMMERCE_EVENT_TYPES.nudgeEmitted) {
    const kind =
      typeof input.payload.nudgeKind === "string"
        ? input.payload.nudgeKind
        : "unknown";
    const timingKind =
      typeof input.payload.timingKind === "string" &&
      input.payload.timingKind.trim()
        ? input.payload.timingKind.trim()
        : "none";
    return {
      metricDate,
      nudgeImpressions: 1,
      offerConversions: 0,
      conversionLagSeconds: 0,
      nudgeDeclined: 0,
      nudgeIgnored: 0,
      nudgeExpired: 0,
      byNudgeKind: bumpMap({}, kind, 1),
      byOfferResolution: {},
      byOutcome: {},
      byTimingKind: bumpMap({}, timingKind, 1),
    };
  }

  if (input.eventType === COMMERCE_EVENT_TYPES.offerConverted) {
    const kind =
      typeof input.payload.nudgeKind === "string"
        ? input.payload.nudgeKind
        : "unknown";
    const resolution =
      typeof input.payload.offerResolution === "string" &&
      input.payload.offerResolution.trim()
        ? input.payload.offerResolution
        : "unknown";
    const lagSeconds =
      typeof input.payload.lagSeconds === "number" &&
      Number.isFinite(input.payload.lagSeconds)
        ? Math.max(0, Math.round(input.payload.lagSeconds))
        : 0;

    return {
      metricDate,
      nudgeImpressions: 0,
      offerConversions: 1,
      conversionLagSeconds: lagSeconds,
      nudgeDeclined: 0,
      nudgeIgnored: 0,
      nudgeExpired: 0,
      byNudgeKind: bumpMap({}, kind, 1),
      byOfferResolution: bumpMap({}, resolution, 1),
      byOutcome: bumpMap({}, "accepted", 1),
      byTimingKind: {},
    };
  }

  if (input.eventType === COMMERCE_EVENT_TYPES.nudgeResolved) {
    const kind =
      typeof input.payload.nudgeKind === "string"
        ? input.payload.nudgeKind
        : "unknown";
    const outcome =
      typeof input.payload.outcome === "string"
        ? input.payload.outcome
        : "unknown";

    return {
      metricDate,
      nudgeImpressions: 0,
      offerConversions: 0,
      conversionLagSeconds: 0,
      nudgeDeclined: outcome === "declined" ? 1 : 0,
      nudgeIgnored: outcome === "ignored" ? 1 : 0,
      nudgeExpired: outcome === "expired" ? 1 : 0,
      byNudgeKind: bumpMap({}, kind, 1),
      byOfferResolution: {},
      byOutcome: bumpMap({}, outcome, 1),
      byTimingKind: {},
    };
  }

  return {
    metricDate,
    nudgeImpressions: 0,
    offerConversions: 0,
    conversionLagSeconds: 0,
    nudgeDeclined: 0,
    nudgeIgnored: 0,
    nudgeExpired: 0,
    byNudgeKind: {},
    byOfferResolution: {},
    byOutcome: {},
    byTimingKind: {},
  };
}

function mergeJsonMaps(a: JsonMap, b: JsonMap): JsonMap {
  const next = { ...a };
  for (const [key, value] of Object.entries(b)) {
    next[key] = (next[key] ?? 0) + value;
  }
  return next;
}

function hasRollupActivity(delta: ReturnType<typeof anticipationRollupDelta>): boolean {
  return (
    delta.nudgeImpressions > 0 ||
    delta.offerConversions > 0 ||
    delta.nudgeDeclined > 0 ||
    delta.nudgeIgnored > 0 ||
    delta.nudgeExpired > 0
  );
}

export async function upsertAnticipationRollup(
  admin: SupabaseClient,
  input: AnticipationRollupInput
): Promise<void> {
  const delta = anticipationRollupDelta(input);

  if (!hasRollupActivity(delta)) {
    return;
  }

  const { data: existing } = await admin
    .from("experience_analytics_daily" as never)
    .select(
      "nudge_impressions, offer_conversions, conversion_lag_seconds, nudge_declined, nudge_ignored, nudge_expired, by_nudge_kind, by_offer_resolution, by_outcome, by_timing_kind"
    )
    .eq("location_id", input.locationId)
    .eq("metric_date", delta.metricDate)
    .maybeSingle();

  const row = existing as {
    nudge_impressions?: number;
    offer_conversions?: number;
    conversion_lag_seconds?: number;
    nudge_declined?: number;
    nudge_ignored?: number;
    nudge_expired?: number;
    by_nudge_kind?: JsonMap;
    by_offer_resolution?: JsonMap;
    by_outcome?: JsonMap;
    by_timing_kind?: JsonMap;
  } | null;

  const byNudgeKind = mergeJsonMaps(row?.by_nudge_kind ?? {}, delta.byNudgeKind);
  const byOfferResolution = mergeJsonMaps(
    row?.by_offer_resolution ?? {},
    delta.byOfferResolution
  );
  const byOutcome = mergeJsonMaps(row?.by_outcome ?? {}, delta.byOutcome);
  const byTimingKind = mergeJsonMaps(
    row?.by_timing_kind ?? {},
    delta.byTimingKind
  );

  const { error } = await admin.from("experience_analytics_daily" as never).upsert(
    {
      org_id: input.orgId,
      location_id: input.locationId,
      metric_date: delta.metricDate,
      nudge_impressions: (row?.nudge_impressions ?? 0) + delta.nudgeImpressions,
      offer_conversions: (row?.offer_conversions ?? 0) + delta.offerConversions,
      conversion_lag_seconds:
        (row?.conversion_lag_seconds ?? 0) + delta.conversionLagSeconds,
      nudge_declined: (row?.nudge_declined ?? 0) + delta.nudgeDeclined,
      nudge_ignored: (row?.nudge_ignored ?? 0) + delta.nudgeIgnored,
      nudge_expired: (row?.nudge_expired ?? 0) + delta.nudgeExpired,
      by_nudge_kind: byNudgeKind,
      by_offer_resolution: byOfferResolution,
      by_outcome: byOutcome,
      by_timing_kind: byTimingKind,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "location_id,metric_date" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
