import type { MenuSection } from "@/lib/menu-section";
import { matchUpsellRules } from "@/lib/upsell/rule-engine";
import { normalizeUpsellRule } from "@/lib/upsell/rule-types";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_UPSELL_SUGGESTIONS = 3;

export type UpsellSuggestion = {
  ruleId: string;
  message: string | null;
  abVariantId: string | null;
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

export async function getSuggestions(
  locationId: string,
  cartProductIds: string[],
  cartCategoryIds: string[],
  options?: {
    cartTotalEuros?: number;
    dismissedNudgeKeys?: string[];
    respectDecline?: boolean;
    guestTags?: string[];
    localHour?: number;
  }
): Promise<UpsellSuggestion[]> {
  if (cartProductIds.length === 0) return [];

  const admin = createAdminClient();

  const { data: rules } = await admin
    .from("upsell_rules")
    .select(
      "id, location_id, rule_type, trigger_product_id, trigger_category_id, suggest_product_id, message, conditions, ab_variants, sort_order, is_active, impressions_count, conversions_count, declines_count"
    )
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const ruleRows = ((rules ?? []) as Array<Parameters<typeof normalizeUpsellRule>[0]>).map(
    normalizeUpsellRule
  );
  if (ruleRows.length === 0) return [];

  const matched = matchUpsellRules(
    ruleRows,
    {
      cartProductIds,
      cartCategoryIds,
      cartTotalEuros: options?.cartTotalEuros ?? 0,
      localHour: options?.localHour ?? new Date().getHours(),
      guestTags: options?.guestTags ?? [],
      dismissedNudgeKeys: options?.dismissedNudgeKeys ?? [],
      respectDecline: options?.respectDecline ?? true,
    },
    MAX_UPSELL_SUGGESTIONS
  );

  if (matched.length === 0) return [];

  const suggestIds = matched.map((row) => row.rule.suggest_product_id);

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

  for (const row of matched) {
    const product = productMap.get(row.rule.suggest_product_id);
    if (!product) continue;

    suggestions.push({
      ruleId: row.rule.id,
      message: row.message || null,
      abVariantId: row.abVariantId,
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
