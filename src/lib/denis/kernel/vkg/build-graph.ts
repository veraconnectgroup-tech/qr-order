import type {
  VenueKnowledgeGraph,
  VkgCategoryNode,
  VkgEdge,
  VkgProductNode,
} from "@/lib/denis/kernel/vkg/types";

export type UpsellRuleSnapshot = {
  id: string;
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  suggest_product_id: string;
  message: string | null;
  sort_order: number;
};

export type CatalogProductSnapshot = {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  is_available: boolean;
  allergens: string[] | null;
  ai_description: string | null;
  menu_section: string;
};

export type CatalogCategorySnapshot = {
  id: string;
  name: string;
  menu_section: string;
};

export function buildVenueKnowledgeGraph(input: {
  locationId: string;
  products: CatalogProductSnapshot[];
  categories: CatalogCategorySnapshot[];
  upsellRules: UpsellRuleSnapshot[];
  builtAt?: string;
}): VenueKnowledgeGraph {
  const products: Record<string, VkgProductNode> = {};
  const categories: Record<string, VkgCategoryNode> = {};
  const categorySection = new Map(
    input.categories.map((c) => [c.id, c.menu_section])
  );

  for (const cat of input.categories) {
    categories[cat.id] = {
      id: cat.id,
      kind: "category",
      name: cat.name,
      menuSection: cat.menu_section,
    };
  }

  for (const row of input.products) {
    products[row.id] = {
      id: row.id,
      kind: "product",
      name: row.name,
      categoryId: row.category_id,
      menuSection:
        row.menu_section ||
        (row.category_id ? categorySection.get(row.category_id) : null) ||
        "food",
      allergens: row.allergens ?? [],
      price: Number(row.price),
      isAvailable: row.is_available,
      aiDescription: row.ai_description,
    };
  }

  const edges: VkgEdge[] = [];
  const maxSort =
    input.upsellRules.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;

  for (const rule of input.upsellRules) {
    if (!products[rule.suggest_product_id]?.isAvailable) continue;

    const weight = Math.max(0.1, 1 - rule.sort_order / (maxSort + 1));
    const reason = rule.message?.trim() || "Admin upsell rule";

    if (rule.trigger_product_id) {
      edges.push({
        type: "pairs_with",
        fromKind: "product",
        fromId: rule.trigger_product_id,
        toProductId: rule.suggest_product_id,
        weight,
        reason,
        ruleId: rule.id,
      });
    }

    if (rule.trigger_category_id) {
      edges.push({
        type: "pairs_with",
        fromKind: "category",
        fromId: rule.trigger_category_id,
        toProductId: rule.suggest_product_id,
        weight,
        reason,
        ruleId: rule.id,
      });
    }
  }

  return {
    locationId: input.locationId,
    builtAt: input.builtAt ?? new Date().toISOString(),
    products,
    categories,
    edges,
  };
}
