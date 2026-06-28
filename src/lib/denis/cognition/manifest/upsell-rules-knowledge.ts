import type { UpsellRuleRecord } from "@/lib/upsell/rule-types";
import { UPSELL_RULE_TYPE_LABELS } from "@/lib/upsell/rule-types";
import { computeAcceptRate } from "@/lib/upsell/rule-engine";

/** Compact owner-defined upsell rules block for Denis manifest / system prompt. */
export function buildUpsellRulesKnowledgeBlock(
  rules: UpsellRuleRecord[],
  productNames: Map<string, string>,
  categoryNames: Map<string, string>
): string {
  const active = [...rules]
    .filter((rule) => rule.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 12);

  if (active.length === 0) return "";

  const lines = active.map((rule) => {
    const suggest = productNames.get(rule.suggest_product_id) ?? "item";
    const type = UPSELL_RULE_TYPE_LABELS[rule.rule_type];
    let trigger = type;

    if (rule.rule_type === "product_product" && rule.trigger_product_id) {
      trigger = `${productNames.get(rule.trigger_product_id) ?? "product"} → ${suggest}`;
    } else if (rule.rule_type === "category_product" && rule.trigger_category_id) {
      trigger = `${categoryNames.get(rule.trigger_category_id) ?? "category"} → ${suggest}`;
    } else if (rule.rule_type === "time_based") {
      trigger = `After ${rule.conditions.afterHour ?? "?"}:00 → ${suggest}`;
    } else if (rule.rule_type === "cart_value") {
      trigger = `Cart ≥ €${rule.conditions.minCartEuros ?? "?"} → ${suggest}`;
    } else if (rule.rule_type === "guest_level") {
      trigger = `${(rule.conditions.guestTags ?? []).join("/") || "VIP"} → ${suggest}`;
    }

    const rate = computeAcceptRate(rule);
    const hint = rule.message?.trim() ? ` (“${rule.message.trim()}”)` : "";
    return `- [P${rule.sort_order + 1}] ${trigger}${hint} · accept ${rate}%`;
  });

  return ["Owner upsell rules (respect declines, max 2 per rule):", ...lines].join("\n");
}
