"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PlaybookInput } from "@/lib/admin/generate-venue-playbook";

type CategoryRow = {
  id: string;
  name: string;
  menu_section: string | null;
  sort_order: number;
};

type ProductRow = {
  name: string;
  sort_order: number;
  is_available: boolean;
  deleted_at: string | null;
  category_id: string;
};

/** Load VKG menu hints for smart playbook generation. */
export async function loadPlaybookGenerationContext(
  orgId: string,
  locationId: string
): Promise<
  Pick<
    PlaybookInput,
    "venueName" | "menuSections" | "topProducts" | "language"
  >
> {
  const admin = createAdminClient();

  const [{ data: location }, { data: categories }, { data: products }] =
    await Promise.all([
      admin
        .from("locations")
        .select("name, menu_locale, default_locale")
        .eq("id", locationId)
        .eq("org_id", orgId)
        .single(),
      admin
        .from("categories")
        .select("id, name, menu_section, sort_order")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order"),
      admin
        .from("products")
        .select("name, sort_order, is_available, deleted_at, category_id")
        .eq("location_id", locationId)
        .is("deleted_at", null)
        .order("sort_order"),
    ]);

  const locationRow = location as {
    name: string;
    menu_locale: string | null;
    default_locale: string | null;
  } | null;

  const categoryRows = (categories ?? []) as CategoryRow[];
  const productRows = (products ?? []) as ProductRow[];

  const menuSections = [
    ...new Set(
      categoryRows
        .map((c) => c.menu_section?.trim() || c.name.trim())
        .filter(Boolean)
    ),
  ];

  const productsByCategory = new Map<string, ProductRow[]>();
  for (const product of productRows) {
    if (!product.is_available || product.deleted_at) continue;
    const list = productsByCategory.get(product.category_id) ?? [];
    list.push(product);
    productsByCategory.set(product.category_id, list);
  }

  const topProducts: PlaybookInput["topProducts"] = [];
  for (const category of categoryRows) {
    const categoryProducts = (productsByCategory.get(category.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order
    );
    for (const product of categoryProducts.slice(0, 2)) {
      if (topProducts.length >= 8) break;
      topProducts.push({
        name: product.name,
        category: category.name,
      });
    }
    if (topProducts.length >= 8) break;
  }

  return {
    venueName: locationRow?.name?.trim() ?? "Venue",
    menuSections,
    topProducts,
    language:
      locationRow?.menu_locale?.trim() ||
      locationRow?.default_locale?.trim() ||
      "sr",
  };
}
