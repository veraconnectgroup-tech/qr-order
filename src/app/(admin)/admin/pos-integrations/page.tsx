import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { PosIntegrationsPanel } from "@/components/admin/pos-integrations-panel";
import { getPosIntegrations } from "@/lib/pos/pos-actions";

export default async function AdminPosIntegrationsPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Location not found.</p>
      </div>
    );
  }

  const integrations = await getPosIntegrations(locationId);

  return (
    <div className="p-6">
      <PosIntegrationsPanel
        integrations={integrations}
        locationId={locationId}
      />
    </div>
  );
}
