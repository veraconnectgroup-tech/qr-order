import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpsellManager } from "@/components/admin/upsell-manager";
import type { Category, Product, UpsellRule } from "@/types";

export default async function AdminUpsellsPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Location not found.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: rules }, { data: products }, { data: categories }] =
    await Promise.all([
      admin
        .from("upsell_rules")
        .select("*")
        .eq("location_id", locationId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("products")
        .select("*")
        .eq("location_id", locationId)
        .is("deleted_at", null)
        .order("name"),
      admin
        .from("categories")
        .select("*")
        .eq("location_id", locationId)
        .is("deleted_at", null)
        .order("sort_order"),
    ]);

  return (
    <div className="p-6">
      <UpsellManager
        rules={(rules ?? []) as UpsellRule[]}
        products={(products ?? []) as Product[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
