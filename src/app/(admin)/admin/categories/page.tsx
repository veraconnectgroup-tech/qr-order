import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CategoriesManager, type CategoryRow } from "@/components/admin/categories-manager";
import type { Product } from "@/types";

export default async function AdminCategoriesPage() {
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
  const [{ data: categories }, { data: products }] = await Promise.all([
    admin
      .from("categories")
      .select("*")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("sort_order"),
    admin
      .from("products")
      .select("id, category_id")
      .eq("location_id", locationId)
      .is("deleted_at", null),
  ]);

  const productCounts = new Map<string, number>();
  for (const product of (products ?? []) as Pick<Product, "id" | "category_id">[]) {
    if (!product.category_id) continue;
    productCounts.set(
      product.category_id,
      (productCounts.get(product.category_id) ?? 0) + 1
    );
  }

  const rows: CategoryRow[] = (categories ?? []).map((category) => ({
    ...category,
    productCount: productCounts.get(category.id) ?? 0,
  }));

  return (
    <div className="p-6">
      <CategoriesManager categories={rows} />
    </div>
  );
}
