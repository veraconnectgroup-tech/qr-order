import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_WAITLIST_CONFIG,
  formatWaitlistStaffView,
  resolveNoShowEntries,
} from "@/lib/denis/commerce/waitlist";
import { loadWaitlistFloorSnapshot } from "@/lib/denis/commerce/load-waitlist-floor-snapshot";
import { loadWaitlistEntries } from "@/lib/denis/commerce/waitlist-store";

export type WaitlistAdminSnapshot = {
  rows: ReturnType<typeof formatWaitlistStaffView>;
  queueLength: number;
  config: typeof DEFAULT_WAITLIST_CONFIG;
  floor: Awaited<ReturnType<typeof loadWaitlistFloorSnapshot>>;
};

export async function loadWaitlistAdminSnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<WaitlistAdminSnapshot> {
  const floor = await loadWaitlistFloorSnapshot(
    admin,
    locationId,
    DEFAULT_WAITLIST_CONFIG.avgTurnoverMinutes
  );

  const entries = resolveNoShowEntries(
    await loadWaitlistEntries(locationId),
    DEFAULT_WAITLIST_CONFIG
  );

  const waiting = entries.filter(
    (entry) => entry.status === "waiting" || entry.status === "notified"
  );

  return {
    config: DEFAULT_WAITLIST_CONFIG,
    floor,
    queueLength: waiting.length,
    rows: formatWaitlistStaffView(entries, DEFAULT_WAITLIST_CONFIG, floor),
  };
}
