import { LocationsManager } from "@/components/admin/locations-manager";
import { requireOwner } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminLocationsPage() {
  await requireOwner();

  const admin = createAdminClient();
  const staff = await requireOwner();
  const { data } = await admin
    .from("locations")
    .select("id, name, address, city, postal_code, is_active, created_at")
    .eq("org_id", staff.org_id)
    .order("created_at", { ascending: true });

  return (
    <div className="p-6">
      <LocationsManager
        locations={
          (data ?? []) as Array<{
            id: string;
            name: string;
            address: string | null;
            city: string | null;
            postal_code: string | null;
            is_active: boolean;
            created_at: string;
          }>
        }
      />
    </div>
  );
}
