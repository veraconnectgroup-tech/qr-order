import { LocationsManager } from "@/components/admin/locations-manager";
import { MenuSyncPanel } from "@/components/admin/menu-sync-panel";
import { requireOwner } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminLocationsPage() {
  const staff = await requireOwner();

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, name, address, city, postal_code, is_active, created_at")
    .eq("org_id", staff.org_id)
    .order("created_at", { ascending: true });

  const locations = (data ?? []) as Array<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    is_active: boolean;
    created_at: string;
  }>;

  return (
    <div className="space-y-8 p-6">
      <LocationsManager locations={locations} />
      {locations.length >= 2 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Menu sync</h2>
          <MenuSyncPanel
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        </div>
      )}
    </div>
  );
}
