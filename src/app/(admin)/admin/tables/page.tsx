import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { TablesManager } from "@/components/admin/tables-manager";
import type { Table, Zone } from "@/types";

export default async function AdminTablesPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  const supabase = await createServerClient();

  const [{ data: tables }, { data: zones }] = await Promise.all([
    supabase
      .from("tables")
      .select("*")
      .eq("location_id", locationId!)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("zones")
      .select("*")
      .eq("location_id", locationId!)
      .order("sort_order"),
  ]);

  return (
    <div className="p-6">
      <TablesManager
        tables={(tables ?? []) as Table[]}
        zones={(zones ?? []) as Zone[]}
        orgSlug={staff.organizations?.slug ?? ""}
        orgName={staff.organizations?.name ?? ""}
      />
    </div>
  );
}
