import { subDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateAbandonmentPreventionFromTimelines,
  type AbandonmentPreventionAnalytics,
} from "@/lib/admin/aggregate-abandonment-prevention";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";

export type AbandonmentPreventionSnapshot = AbandonmentPreventionAnalytics & {
  locationId: string;
  locationName: string;
  periodDays: number;
  fromDate: string;
  toDate: string;
};

const TIMELINE_SESSION_LIMIT = 150;

export async function loadAbandonmentPreventionSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    periodDays?: number;
  }
): Promise<AbandonmentPreventionSnapshot | null> {
  const periodDays = input.periodDays ?? 7;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");

  const { data: locationRow } = await admin
    .from("locations")
    .select("id, name")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  const since = subDays(new Date(), periodDays).toISOString();
  const { data: sessionRows } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", input.locationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(TIMELINE_SESSION_LIMIT);

  const timelines = [];
  for (const row of (sessionRows ?? []) as Array<{ id: string }>) {
    timelines.push(await loadDenisTimeline(admin, row.id));
  }

  const analytics = aggregateAbandonmentPreventionFromTimelines(timelines);

  return {
    locationId: input.locationId,
    locationName: (locationRow as { name: string }).name,
    periodDays,
    fromDate,
    toDate,
    ...analytics,
  };
}
