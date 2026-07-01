import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inventoryAlertToStaffNotification,
} from "@/lib/denis/intelligence/inventory-awareness";
import { loadVenueInventorySnapshot } from "@/lib/denis/intelligence/load-venue-inventory";
import { persistStaffNotification } from "@/lib/denis/notifications/persist-staff-notification";

/** Push inventory alerts to staff notification feed (W3). */
export async function dispatchInventoryAlerts(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    depletedProductIds?: string[];
    timezone?: string | null;
  }
): Promise<void> {
  const snapshot = await loadVenueInventorySnapshot(admin, {
    locationId: input.locationId,
    timezone: input.timezone,
  });

  const alerts = snapshot.alerts.filter((alert) => {
    if (!input.depletedProductIds?.length) return true;
    return (
      input.depletedProductIds.includes(alert.productId) ||
      alert.type !== "just_ran_out"
    );
  });

  for (const alert of alerts.slice(0, 8)) {
    const notification = inventoryAlertToStaffNotification(alert);
    await persistStaffNotification(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      notification,
    });
  }
}

/** Morning kitchen prep — replenishment lines from low/critical stock (W3). */
export async function loadMorningInventoryPrepLines(
  admin: SupabaseClient,
  locationId: string,
  timezone?: string | null
): Promise<string[]> {
  const snapshot = await loadVenueInventorySnapshot(admin, {
    locationId,
    timezone,
  });

  return snapshot.alerts
    .filter(
      (alert) =>
        alert.type === "running_low" || alert.type === "will_run_out_today"
    )
    .map((alert) => alert.suggestion)
    .slice(0, 5);
}
