import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveStationVoiceSnapshot,
  type StationVoiceSnapshot,
} from "@/lib/denis/venue/floor/resolve-station-voice-snapshot";
import type { KitchenBacklogOrder } from "@/lib/denis/venue/floor/compute-kds-backlog";

const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing"];

/** Loads real order backlog + open-question count, then derives the station's voice tone snapshot. */
export async function loadStationVoiceSnapshot(
  admin: SupabaseClient,
  locationId: string,
  station: "kitchen" | "bar"
): Promise<StationVoiceSnapshot> {
  const [{ count: openQuestionCount }, { data: orderRows }] = await Promise.all([
    admin
      .from("station_questions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("station", station)
      .eq("status", "open"),
    admin
      .from("orders")
      .select("status, created_at, accepted_at, preparing_at, order_items(menu_section)")
      .eq("location_id", locationId)
      .in("status", ACTIVE_ORDER_STATUSES),
  ]);

  return resolveStationVoiceSnapshot({
    orders: (orderRows ?? []) as unknown as KitchenBacklogOrder[],
    openQuestionCount: openQuestionCount ?? 0,
    station,
  });
}
