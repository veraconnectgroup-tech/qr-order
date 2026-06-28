import { ThresholdOptimizationView } from "@/components/dashboard/threshold-optimization-view";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadThresholdOptimizationSnapshot } from "@/lib/admin/load-threshold-optimization";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ThresholdOptimizationPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-dash-text-secondary">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const config = await loadConciergeConfigForLocation(locationId);
  const snapshot = await loadThresholdOptimizationSnapshot(admin, {
    locationId,
    config,
    periodDays: 14,
  });

  return <ThresholdOptimizationView snapshot={snapshot} />;
}
