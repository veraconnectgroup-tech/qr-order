import type { MenuSection } from "@/lib/menu-section";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_UPSELL_SUGGESTIONS = 3;

export type UpsellSuggestion = {
  ruleId: string;
  message: string | null;
  product: {
    id: string;
    name: string;
    name_en: string | null;
    price: number;
    image_url: string | null;
    category_id: string | null;
    tax_rate: number | null;
    menuSection: MenuSection;
    hasModifiers: boolean;
  };
};

type UpsellRuleRow = {
  id: string;
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  suggest_product_id: string;
  message: string | null;
  sort_order: number;
};

export async function getSuggestions(
  locationId: string,
  cartProductIds: string[],
  cartCategoryIds: string[]
): Promise<UpsellSuggestion[]> {
  if (cartProductIds.length === 0) return [];

  const admin = createAdminClient();
  const cartProductSet = new Set(cartProductIds);
  const cartCategorySet = new Set(cartCategoryIds);

  const { data: rules } = await admin
    .from("upsell_rules")
    .select(
      "id, trigger_product_id, trigger_category_id, suggest_product_id, message, sort_order"
    )
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const ruleRows = (rules as UpsellRuleRow[]) ?? [];
  if (ruleRows.length === 0) return [];

  const matchedRules: UpsellRuleRow[] = [];
  const seenSuggestIds = new Set<string>();

  for (const rule of ruleRows) {
    if (cartProductSet.has(rule.suggest_product_id)) continue;
    if (seenSuggestIds.has(rule.suggest_product_id)) continue;

    const productTrigger =
      rule.trigger_product_id != null &&
      cartProductSet.has(rule.trigger_product_id);
    const categoryTrigger =
      rule.trigger_category_id != null &&
      cartCategorySet.has(rule.trigger_category_id);

    if (!productTrigger && !categoryTrigger) continue;

    matchedRules.push(rule);
    seenSuggestIds.add(rule.suggest_product_id);
    if (matchedRules.length >= MAX_UPSELL_SUGGESTIONS) break;
  }

  if (matchedRules.length === 0) return [];

  const suggestIds = matchedRules.map((r) => r.suggest_product_id);

  const { data: products } = await admin
    .from("products")
    .select(
      "id, name, name_en, price, image_url, category_id, tax_rate, is_available"
    )
    .in("id", suggestIds)
    .eq("location_id", locationId)
    .eq("is_available", true)
    .is("deleted_at", null);

  type ProductRow = {
    id: string;
    name: string;
    name_en: string | null;
    price: number;
    image_url: string | null;
    category_id: string | null;
    tax_rate: number | null;
  };

  const productRows = (products as ProductRow[]) ?? [];
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const categoryIds = [
    ...new Set(
      productRows.map((p) => p.category_id).filter((id): id is string => !!id)
    ),
  ];

  const categorySectionMap = new Map<string, MenuSection>();
  if (categoryIds.length > 0) {
    const { data: categories } = await admin
      .from("categories")
      .select("id, menu_section")
      .in("id", categoryIds);

    for (const cat of (categories as Array<{ id: string; menu_section: string }>) ??
      []) {
      categorySectionMap.set(
        cat.id,
        (cat.menu_section as MenuSection) ?? "food"
      );
    }
  }

  const { data: modifierGroups } = await admin
    .from("modifier_groups")
    .select("product_id")
    .in("product_id", suggestIds);

  const productsWithModifiers = new Set(
    ((modifierGroups as Array<{ product_id: string }>) ?? []).map(
      (g) => g.product_id
    )
  );

  const suggestions: UpsellSuggestion[] = [];

  for (const rule of matchedRules) {
    const product = productMap.get(rule.suggest_product_id);
    if (!product) continue;

    suggestions.push({
      ruleId: rule.id,
      message: rule.message,
      product: {
        id: product.id,
        name: product.name,
        name_en: product.name_en,
        price: Number(product.price),
        image_url: product.image_url,
        category_id: product.category_id,
        tax_rate: product.tax_rate != null ? Number(product.tax_rate) : null,
        menuSection: product.category_id
          ? (categorySectionMap.get(product.category_id) ?? "food")
          : "food",
        hasModifiers: productsWithModifiers.has(product.id),
      },
    });
  }

  return suggestions;
}

export async function resolveCartCategoryIds(
  locationId: string,
  cartProductIds: string[]
): Promise<string[]> {
  if (cartProductIds.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("category_id")
    .in("id", cartProductIds)
    .eq("location_id", locationId)
    .is("deleted_at", null);

  const ids = new Set<string>();
  for (const row of (data as Array<{ category_id: string | null }>) ?? []) {
    if (row.category_id) ids.add(row.category_id);
  }
  return [...ids];
}
