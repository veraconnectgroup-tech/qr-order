import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadEventAdminSnapshot } from "@/lib/admin/denis-event-mode";
import { DenisEventPanel } from "@/components/admin/denis-event-panel";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminEventsPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const snapshot = await loadEventAdminSnapshot(admin, locationId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Denis event mode — preset meni, batch narudžbine, copilot statistika i
          automatska detekcija okupljanja (5+ QR skenova u 10 min).
        </p>
      </div>

      <DenisEventPanel snapshot={snapshot} />
    </div>
  );
}
