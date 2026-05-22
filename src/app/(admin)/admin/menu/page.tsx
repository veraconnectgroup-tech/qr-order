import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { MenuManager } from "@/components/admin/menu-manager";
import type { Category, Product } from "@/types";

export default async function AdminMenuPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  const supabase = await createServerClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("location_id", locationId!)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("*")
      .eq("location_id", locationId!)
      .order("sort_order"),
  ]);

  const currency = staff.organizations?.currency ?? "EUR";

  return (
    <div className="p-6">
      <MenuManager
        products={(products ?? []) as Product[]}
        categories={(categories ?? []) as Category[]}
        currency={currency}
      />
    </div>
  );
}
