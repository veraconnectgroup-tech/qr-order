import type { UpsellRuleRecord } from "@/lib/upsell/rule-types";
import { matchUpsellRules, type UpsellMatchContext } from "@/lib/upsell/rule-engine";

export type AdminUpsellMatch = {
  ruleId: string;
  suggestProductId: string;
  suggestProductName: string;
  message: string;
  sortOrder: number;
  dismissKey: string;
};

export function buildAdminUpsellMatches(input: {
  rules: UpsellRuleRecord[];
  context: UpsellMatchContext;
  productNames: Map<string, string>;
  limit?: number;
}): AdminUpsellMatch[] {
  const matched = matchUpsellRules(input.rules, input.context, input.limit ?? 3);

  return matched
    .map((row) => {
      const name = input.productNames.get(row.rule.suggest_product_id);
      if (!name) return null;
      return {
        ruleId: row.rule.id,
        suggestProductId: row.rule.suggest_product_id,
        suggestProductName: name,
        message:
          row.message.trim() ||
          `Suggest ${name} based on owner upsell rule.`,
        sortOrder: row.rule.sort_order,
        dismissKey: row.dismissKey,
      };
    })
    .filter((row): row is AdminUpsellMatch => row != null);
}
