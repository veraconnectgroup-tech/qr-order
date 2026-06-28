import {
  DEFAULT_DECLINE_STOP_THRESHOLD,
  type UpsellAbVariant,
  type UpsellRuleRecord,
  upsellRuleDismissKey,
} from "@/lib/upsell/rule-types";

export type UpsellMatchContext = {
  cartProductIds: string[];
  cartCategoryIds: string[];
  cartTotalEuros: number;
  localHour: number;
  guestTags: string[];
  dismissedNudgeKeys: string[];
  respectDecline: boolean;
  maxDeclinesBeforeStop?: number;
};

export type MatchedUpsellRule = {
  rule: UpsellRuleRecord;
  message: string;
  abVariantId: string | null;
  dismissKey: string;
};

export function countRuleDeclines(dismissedKeys: string[], ruleId: string): number {
  const prefix = upsellRuleDismissKey(ruleId);
  return dismissedKeys.filter(
    (key) => key === prefix || key.startsWith(`${prefix}:`)
  ).length;
}

export function shouldSuppressUpsellRule(
  ruleId: string,
  context: Pick<
    UpsellMatchContext,
    "dismissedNudgeKeys" | "respectDecline" | "maxDeclinesBeforeStop"
  >
): boolean {
  if (!context.respectDecline) return false;
  const threshold = context.maxDeclinesBeforeStop ?? DEFAULT_DECLINE_STOP_THRESHOLD;
  return countRuleDeclines(context.dismissedNudgeKeys, ruleId) >= threshold;
}

export function pickAbVariant(
  rule: UpsellRuleRecord
): { message: string; variantId: string | null } {
  const variants = rule.ab_variants.filter((variant) => variant.message.trim());
  if (variants.length === 0) {
    return { message: rule.message?.trim() ?? "", variantId: null };
  }

  const winner = detectAbWinner(variants);
  if (winner && winner.impressions >= 20) {
    return { message: winner.message, variantId: winner.id };
  }

  const totalWeight = variants.reduce((sum, variant) => sum + Math.max(variant.weight, 1), 0);
  let pick = variants[0]!;
  let cursor = Math.random() * totalWeight;
  for (const variant of variants) {
    cursor -= Math.max(variant.weight, 1);
    if (cursor <= 0) {
      pick = variant;
      break;
    }
  }

  return { message: pick.message, variantId: pick.id };
}

export function detectAbWinner(
  variants: UpsellAbVariant[],
  minImpressions = 20
): UpsellAbVariant | null {
  const eligible = variants.filter((variant) => variant.impressions >= minImpressions);
  if (eligible.length === 0) return null;

  return [...eligible].sort((a, b) => {
    const rateA = a.impressions > 0 ? a.conversions / a.impressions : 0;
    const rateB = b.impressions > 0 ? b.conversions / b.impressions : 0;
    return rateB - rateA;
  })[0] ?? null;
}

function ruleMatchesTrigger(rule: UpsellRuleRecord, context: UpsellMatchContext): boolean {
  switch (rule.rule_type) {
    case "product_product":
      return (
        rule.trigger_product_id != null &&
        context.cartProductIds.includes(rule.trigger_product_id)
      );
    case "category_product":
      return (
        rule.trigger_category_id != null &&
        context.cartCategoryIds.includes(rule.trigger_category_id)
      );
    case "time_based": {
      const after = rule.conditions.afterHour;
      if (after == null) return false;
      const before = rule.conditions.beforeHour ?? 24;
      return context.localHour >= after && context.localHour < before;
    }
    case "cart_value":
      return (
        rule.conditions.minCartEuros != null &&
        context.cartTotalEuros >= rule.conditions.minCartEuros
      );
    case "guest_level": {
      const required = rule.conditions.guestTags ?? [];
      if (required.length === 0) return false;
      return required.some((tag) => context.guestTags.includes(tag));
    }
    default:
      return false;
  }
}

export function matchUpsellRules(
  rules: UpsellRuleRecord[],
  context: UpsellMatchContext,
  limit = 3
): MatchedUpsellRule[] {
  const cartProductSet = new Set(context.cartProductIds);
  const matched: MatchedUpsellRule[] = [];
  const seenSuggest = new Set<string>();

  const sorted = [...rules]
    .filter((rule) => rule.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of sorted) {
    if (cartProductSet.has(rule.suggest_product_id)) continue;
    if (seenSuggest.has(rule.suggest_product_id)) continue;
    if (shouldSuppressUpsellRule(rule.id, context)) continue;
    if (!ruleMatchesTrigger(rule, context)) continue;

    const picked = pickAbVariant(rule);
    matched.push({
      rule,
      message: picked.message,
      abVariantId: picked.variantId,
      dismissKey: upsellRuleDismissKey(rule.id),
    });
    seenSuggest.add(rule.suggest_product_id);
    if (matched.length >= limit) break;
  }

  return matched;
}

export function computeAcceptRate(rule: UpsellRuleRecord): number {
  if (rule.impressions_count <= 0) return 0;
  return Math.round((rule.conversions_count / rule.impressions_count) * 1000) / 10;
}
