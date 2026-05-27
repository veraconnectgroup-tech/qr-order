import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { listDenisDebugSessions } from "@/lib/admin/denis-debug";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { DenisVenueSimPanel } from "@/components/admin/denis-venue-sim-panel";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DenisSimAdminPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-neutral-500">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const [sessions, config] = await Promise.all([
    listDenisDebugSessions(admin, locationId),
    loadConciergeConfigForLocation(locationId),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <DenisVenueSimPanel
        sessions={sessions.filter((row) => row.timelineEventCount > 0)}
        defaultFoodAfterDrinks={config.upsell.foodAfterDrinks}
        defaultRushSkipUpsell={config.ops.rushSkipUpsell}
      />
    </div>
  );
}
