import { describe, expect, it } from "vitest";
import { buildUpsellRulesKnowledgeBlock } from "@/lib/denis/cognition/manifest/upsell-rules-knowledge";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  detectAbWinner,
  matchUpsellRules,
  shouldSuppressUpsellRule,
} from "@/lib/upsell/rule-engine";
import type { UpsellRuleRecord } from "@/lib/upsell/rule-types";
import { upsellRuleDismissKey } from "@/lib/upsell/rule-types";

const burgerFriesRule: UpsellRuleRecord = {
  id: "rule-burger-fries",
  location_id: "loc-1",
  rule_type: "product_product",
  trigger_product_id: "burger",
  trigger_category_id: null,
  suggest_product_id: "fries",
  message: "Dodajte pomfrit uz burger?",
  conditions: {},
  ab_variants: [],
  sort_order: 0,
  is_active: true,
  impressions_count: 10,
  conversions_count: 4,
  declines_count: 0,
};

describe("Upsell rules engine", () => {
  it("matches burger → fries and suggests fries", () => {
    const matched = matchUpsellRules(
      [burgerFriesRule],
      {
        cartProductIds: ["burger"],
        cartCategoryIds: ["mains"],
        cartTotalEuros: 14,
        localHour: 20,
        guestTags: [],
        dismissedNudgeKeys: [],
        respectDecline: true,
      },
      3
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.rule.suggest_product_id).toBe("fries");
    expect(matched[0]?.message).toContain("pomfrit");
  });

  it("stops upsell after guest declines twice (respectDecline)", () => {
    const dismissKey = upsellRuleDismissKey("rule-burger-fries");
    expect(
      shouldSuppressUpsellRule("rule-burger-fries", {
        respectDecline: true,
        dismissedNudgeKeys: [dismissKey, dismissKey],
      })
    ).toBe(true);

    const matched = matchUpsellRules(
      [burgerFriesRule],
      {
        cartProductIds: ["burger"],
        cartCategoryIds: ["mains"],
        cartTotalEuros: 14,
        localHour: 20,
        guestTags: [],
        dismissedNudgeKeys: [dismissKey, dismissKey],
        respectDecline: true,
      },
      3
    );
    expect(matched).toHaveLength(0);
  });

  it("detects A/B winner by conversion rate", () => {
    const winner = detectAbWinner(
      [
        {
          id: "a",
          message: "Add fries?",
          weight: 1,
          impressions: 50,
          conversions: 8,
        },
        {
          id: "b",
          message: "Crispy fries pair perfectly!",
          weight: 1,
          impressions: 48,
          conversions: 20,
        },
      ],
      20
    );

    expect(winner?.id).toBe("b");
  });

  it("wires admin upsell rules into Denis proactive candidates", () => {
    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        cartItemCount: 1,
        hasSessionOrders: false,
        adminUpsellMatches: [
          {
            ruleId: "rule-burger-fries",
            suggestProductId: "fries",
            suggestProductName: "Pomfrit",
            message: "Dodajte pomfrit uz burger?",
            sortOrder: 0,
            dismissKey: upsellRuleDismissKey("rule-burger-fries"),
          },
        ],
      },
      messages: {
        browse: "browse",
        dessert: "dessert",
        slowKitchen: "slow",
        guestWelcome: "welcome",
        browseFollowUp: "follow",
        billPrompt: "bill",
        orderDelay: "delay",
        popularityPair: "pair",
      },
    });

    expect(ranked.some((row) => row.source === "admin_upsell:rule-burger-fries")).toBe(
      true
    );
    expect(ranked[0]?.nudge.message).toContain("pomfrit");
  });

  it("builds manifest knowledge block from owner rules", () => {
    const block = buildUpsellRulesKnowledgeBlock(
      [burgerFriesRule],
      new Map([
        ["burger", "Burger"],
        ["fries", "Pomfrit"],
      ]),
      new Map([["mains", "Mains"]])
    );

    expect(block).toContain("Burger → Pomfrit");
    expect(block).toContain("accept 40%");
  });
});
