import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/admin/categories-manager";
import type { Category } from "@/types";

export default async function AdminCategoriesPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("location_id", locationId!)
    .order("sort_order");

  return (
    <div className="p-6">
      <CategoriesManager categories={(data ?? []) as Category[]} />
    </div>
  );
}
