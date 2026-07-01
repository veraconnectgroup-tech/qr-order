import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAdminUpsellMatches } from "@/lib/denis/cognition/proactive/admin-upsell-candidates";
import { matchUpsellRules, type UpsellMatchContext } from "@/lib/upsell/rule-engine";
import { normalizeUpsellRule } from "@/lib/upsell/rule-types";

export async function loadLocationUpsellRules(
  admin: SupabaseClient,
  locationId: string
) {
  const { data } = await admin
    .from("upsell_rules")
    .select(
      "id, location_id, rule_type, trigger_product_id, trigger_category_id, suggest_product_id, message, conditions, ab_variants, sort_order, is_active, impressions_count, conversions_count, declines_count"
    )
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as Array<Parameters<typeof normalizeUpsellRule>[0]>).map(
    normalizeUpsellRule
  );
}

export async function loadAdminUpsellMatches(
  admin: SupabaseClient,
  input: {
    locationId: string;
    cartProductIds: string[];
    cartTotalEuros: number;
    dismissedNudgeKeys: string[];
    respectDecline: boolean;
    guestTags?: string[];
    localHour?: number;
    limit?: number;
  }
) {
  const rules = await loadLocationUpsellRules(admin, input.locationId);
  if (rules.length === 0 || input.cartProductIds.length === 0) return [];

  const { data: products } = await admin
    .from("products")
    .select("id, name, category_id")
    .eq("location_id", input.locationId)
    .in("id", [...new Set(input.cartProductIds)]);

  const productNames = new Map<string, string>();
  const categoryIds = new Set<string>();
  for (const row of (products ?? []) as Array<{
    id: string;
    name: string;
    category_id: string | null;
  }>) {
    productNames.set(row.id, row.name);
    if (row.category_id) categoryIds.add(row.category_id);
  }

  const context: UpsellMatchContext = {
    cartProductIds: input.cartProductIds,
    cartCategoryIds: [...categoryIds],
    cartTotalEuros: input.cartTotalEuros,
    localHour: input.localHour ?? new Date().getHours(),
    guestTags: input.guestTags ?? [],
    dismissedNudgeKeys: input.dismissedNudgeKeys,
    respectDecline: input.respectDecline,
  };

  return buildAdminUpsellMatches({
    rules,
    context,
    productNames,
    limit: input.limit,
  });
}

export { matchUpsellRules, normalizeUpsellRule };
