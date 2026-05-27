import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import { createServerClient } from "@/lib/supabase/server";
import { TablesManager } from "@/components/admin/tables-manager";
import type { Staff, Table, Zone } from "@/types";

export default async function AdminTablesPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No location assigned to this account.
      </div>
    );
  }

  const supabase = await createServerClient();

  const [{ data: tables }, { data: zones }, { data: staffRows }, { data: location }] =
    await Promise.all([
    supabase
      .from("tables")
      .select("*")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("zones")
      .select("*")
      .eq("location_id", locationId)
      .order("sort_order"),
    supabase
      .from("staff")
      .select("id, name")
      .eq("org_id", staff.org_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("locations")
      .select("menu_locale, default_locale")
      .eq("id", locationId)
      .single(),
  ]);

  const locationRow = location as {
    menu_locale: string | null;
    default_locale: string | null;
  } | null;

  const menuLocale = parseMenuLocaleFromDb(
    locationRow?.menu_locale,
    locationRow?.default_locale
  );

  return (
    <div className="p-6">
      <TablesManager
        tables={(tables ?? []) as Table[]}
        zones={(zones ?? []) as Zone[]}
        staffMembers={(staffRows ?? []) as Pick<Staff, "id" | "name">[]}
        orgSlug={staff.organizations?.slug ?? ""}
        orgName={staff.organizations?.name ?? ""}
        menuLocale={menuLocale}
      />
    </div>
  );
}
