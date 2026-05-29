import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { KassenmeldungPanel } from "@/components/admin/kassenmeldung-panel";
import { listFiscalRegistrations } from "@/lib/fiscal/kassenmeldung";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminKassenmeldungPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Location not found.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  const [{ data: registersRaw }, registrations] = await Promise.all([
    admin
      .from("fiscal_registers")
      .select("id, kassen_id, location_id, locations ( name )")
      .eq("org_id", staff.org_id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    listFiscalRegistrations(admin, staff.org_id, locationId),
  ]);

  const registers = (registersRaw ?? []).map((row) => {
    const r = row as {
      id: string;
      kassen_id: string;
      location_id: string;
      locations: { name: string } | { name: string }[] | null;
    };
    const location = Array.isArray(r.locations)
      ? r.locations[0]
      : r.locations;
    return {
      id: r.id,
      kassen_id: r.kassen_id,
      location_id: r.location_id,
      location_name: location?.name ?? r.location_id,
    };
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">
          Kassenmeldepflicht
        </h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Registrierung der technischen Sicherheitseinrichtung beim Finanzamt
        </p>
      </div>

      <KassenmeldungPanel
        registrations={registrations}
        registers={registers.filter((row) => row.location_id === locationId)}
        locationId={locationId}
      />
    </div>
  );
}
