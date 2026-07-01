import type { SupabaseClient } from "@supabase/supabase-js";
import {
  pickMenuEngineeringDessert,
  pickStarPopularityPair,
  type MenuEngineeringCategory,
} from "@/lib/denis/platform/menu-engineering";
import { loadMenuEngineeringCategoryMap } from "@/lib/denis/platform/load-menu-engineering-categories";

export type ProactiveMenuHints = {
  todaySpecial: string | null;
  dessertProductName: string | null;
  popularityPair: { from: string; to: string } | null;
  menuEngineeringCategories: Record<string, MenuEngineeringCategory>;
  puzzleProductName: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  category:
    | { menu_section: string | null }
    | Array<{ menu_section: string | null }>
    | null;
};

function parseProductRows(data: unknown): ProductRow[] {
  if (!Array.isArray(data)) return [];
  return data as ProductRow[];
}

function menuSection(row: ProductRow): string | null {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  return category?.menu_section ?? null;
}

/** Lightweight menu hints for proactive templates — menu engineering aware (K2). */
export async function loadProactiveMenuHints(
  admin: SupabaseClient,
  locationId: string,
  options?: { cartProductIds?: string[] }
): Promise<ProactiveMenuHints> {
  const [specialResult, productResult, categoryMap] = await Promise.all([
    admin
      .from("products")
      .select("name")
      .eq("location_id", locationId)
      .eq("is_available", true)
      .not("ai_description", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("products")
      .select("id, name, category:categories(menu_section)")
      .eq("location_id", locationId)
      .eq("is_available", true)
      .order("name", { ascending: true })
      .limit(80),
    loadMenuEngineeringCategoryMap(admin, locationId),
  ]);

  const specialRow = specialResult.data as { name: string } | null;
  const products = parseProductRows(productResult.data);

  const desserts = products
    .filter((row) => menuSection(row) === "desserts")
    .map((row) => ({ id: row.id, name: row.name }));

  const engineeringDessert = pickMenuEngineeringDessert({
    desserts,
    categories: categoryMap,
  });

  const puzzleProduct = products.find(
    (row) => categoryMap[row.id] === "puzzle"
  );

  const popularityPair = pickStarPopularityPair({
    products: products.map((row) => ({ id: row.id, name: row.name })),
    categories: categoryMap,
    cartProductIds: options?.cartProductIds,
  });

  return {
    todaySpecial: specialRow?.name?.trim() ?? null,
    dessertProductName: engineeringDessert,
    popularityPair,
    menuEngineeringCategories: categoryMap,
    puzzleProductName: puzzleProduct?.name?.trim() ?? null,
  };
}
