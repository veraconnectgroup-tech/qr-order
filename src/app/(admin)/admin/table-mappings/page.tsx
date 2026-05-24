import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { TableMappingsPanel } from "@/components/admin/table-mappings-panel";

export default async function AdminTableMappingsPage() {
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
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">
        POS Tisch-Mapping
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-neutral-500">
        POS-Tischbezeichnungen auf Vera-Tische abbilden, damit eingehende
        Kassenbestellungen der richtigen Tisch-Session zugeordnet werden.
      </p>
      <TableMappingsPanel locationId={locationId} />
    </div>
  );
}
