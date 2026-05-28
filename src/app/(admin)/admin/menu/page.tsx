import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuManager } from "@/components/admin/menu-manager";
import type { Category, Modifier, ModifierGroup, Product } from "@/types";

type ProductWithModifierGroups = Product & {
  modifier_groups: (ModifierGroup & { modifiers: Modifier[] })[];
};

async function loadProductsWithModifiers(
  locationId: string
): Promise<ProductWithModifierGroups[]> {
  const admin = createAdminClient();

  const { data: productsData } = await admin
    .from("products")
    .select("*")
    .eq("location_id", locationId)
    .is("deleted_at", null)
    .order("sort_order");

  const products = (productsData ?? []) as Product[];
  const productIds = products.map((product) => product.id);

  if (!productIds.length) return [];

  const { data: groupsData } = await admin
    .from("modifier_groups")
    .select("*")
    .in("product_id", productIds)
    .order("sort_order");

  const groups = (groupsData ?? []) as ModifierGroup[];
  const groupIds = groups.map((group) => group.id);

  const { data: modifiersData } = groupIds.length
    ? await admin
        .from("modifiers")
        .select("*")
        .in("group_id", groupIds)
        .eq("is_available", true)
        .order("sort_order")
    : { data: [] };

  const modifiersByGroup = new Map<string, Modifier[]>();
  for (const modifier of (modifiersData ?? []) as Modifier[]) {
    const list = modifiersByGroup.get(modifier.group_id) ?? [];
    list.push(modifier);
    modifiersByGroup.set(modifier.group_id, list);
  }

  const groupsByProduct = new Map<
    string,
    Array<ModifierGroup & { modifiers: Modifier[] }>
  >();
  for (const group of groups) {
    const list = groupsByProduct.get(group.product_id) ?? [];
    list.push({
      ...group,
      modifiers: modifiersByGroup.get(group.id) ?? [],
    });
    groupsByProduct.set(group.product_id, list);
  }

  return products.map((product) => ({
    ...product,
    modifier_groups: groupsByProduct.get(product.id) ?? [],
  }));
}

export default async function AdminMenuPage() {
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
  const [{ data: categories }, { data: org }, products] = await Promise.all([
    admin
      .from("categories")
      .select("*")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("sort_order"),
    admin
      .from("organizations")
      .select("currency")
      .eq("id", staff.org_id)
      .single(),
    loadProductsWithModifiers(locationId),
  ]);

  const currency =
    (org as { currency: string } | null)?.currency ?? "EUR";

  return (
    <div className="p-6">
      <MenuManager
        products={products}
        categories={(categories ?? []) as Category[]}
        currency={currency}
      />
    </div>
  );
}
