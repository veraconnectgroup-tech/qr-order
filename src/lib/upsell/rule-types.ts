export type UpsellRuleType =
  | "product_product"
  | "category_product"
  | "time_based"
  | "cart_value"
  | "guest_level";

export type UpsellAbVariant = {
  id: string;
  message: string;
  weight: number;
  impressions: number;
  conversions: number;
};

export type UpsellRuleConditions = {
  afterHour?: number;
  beforeHour?: number;
  minCartEuros?: number;
  guestTags?: string[];
};

export type UpsellRuleRecord = {
  id: string;
  location_id: string;
  rule_type: UpsellRuleType;
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  suggest_product_id: string;
  message: string | null;
  conditions: UpsellRuleConditions;
  ab_variants: UpsellAbVariant[];
  sort_order: number;
  is_active: boolean;
  impressions_count: number;
  conversions_count: number;
  declines_count: number;
};

export const UPSELL_RULE_TYPE_LABELS: Record<UpsellRuleType, string> = {
  product_product: "Product → Product",
  category_product: "Category → Product",
  time_based: "Time-based",
  cart_value: "Cart value",
  guest_level: "Guest level",
};

export const DEFAULT_DECLINE_STOP_THRESHOLD = 2;

export function upsellRuleDismissKey(ruleId: string): string {
  return `upsell_rule:${ruleId}`;
}

export function parseUpsellConditions(raw: unknown): UpsellRuleConditions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const guestTags = Array.isArray(row.guestTags)
    ? row.guestTags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
  return {
    afterHour:
      typeof row.afterHour === "number" ? row.afterHour : undefined,
    beforeHour:
      typeof row.beforeHour === "number" ? row.beforeHour : undefined,
    minCartEuros:
      typeof row.minCartEuros === "number" ? row.minCartEuros : undefined,
    guestTags,
  };
}

export function parseAbVariants(raw: unknown): UpsellAbVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.message !== "string") {
        return null;
      }
      return {
        id: row.id,
        message: row.message,
        weight: typeof row.weight === "number" ? row.weight : 1,
        impressions: typeof row.impressions === "number" ? row.impressions : 0,
        conversions: typeof row.conversions === "number" ? row.conversions : 0,
      };
    })
    .filter((item): item is UpsellAbVariant => item != null);
}

export function normalizeUpsellRule(row: {
  id: string;
  location_id: string;
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  suggest_product_id: string;
  message: string | null;
  sort_order: number;
  is_active: boolean;
  rule_type?: string | null;
  conditions?: unknown;
  ab_variants?: unknown;
  impressions_count?: number;
  conversions_count?: number;
  declines_count?: number;
}): UpsellRuleRecord {
  const ruleType: UpsellRuleType =
    row.rule_type === "category_product" ||
    row.rule_type === "time_based" ||
    row.rule_type === "cart_value" ||
    row.rule_type === "guest_level"
      ? row.rule_type
      : row.trigger_category_id
        ? "category_product"
        : "product_product";

  return {
    id: row.id,
    location_id: row.location_id,
    rule_type: ruleType,
    trigger_product_id: row.trigger_product_id,
    trigger_category_id: row.trigger_category_id,
    suggest_product_id: row.suggest_product_id,
    message: row.message,
    conditions: parseUpsellConditions(row.conditions),
    ab_variants: parseAbVariants(row.ab_variants),
    sort_order: row.sort_order,
    is_active: row.is_active,
    impressions_count: row.impressions_count ?? 0,
    conversions_count: row.conversions_count ?? 0,
    declines_count: row.declines_count ?? 0,
  };
}
