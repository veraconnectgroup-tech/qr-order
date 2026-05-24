import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { PosIntegrationsPanel } from "@/components/admin/pos-integrations-panel";

export default async function AdminPosIntegrationsPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Standort nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">POS-Integration</h1>
      <PosIntegrationsPanel locationId={locationId} />
    </div>
  );
}
