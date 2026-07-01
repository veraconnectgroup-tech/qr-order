import { describe, expect, it } from "vitest";
import { retrieveCombinedPairingEvidence } from "@/lib/denis/cognition/context/retrievers/vkg-pairing-evidence";
import {
  computeBasketPairs,
  pickLearnedPairForCart,
  pickTopLearnedPopularityPair,
} from "@/lib/denis/config/basket-pair-analysis";
import type { HistoricalOrderRow } from "@/lib/denis/config/basket-pair-types";

const BURGER = "11111111-1111-4111-8111-111111111111";
const FRIES = "22222222-2222-4222-8222-222222222222";
const DRINK = "33333333-3333-4333-8333-333333333333";

function mockSessions(sessionCount: number): HistoricalOrderRow[] {
  const rows: HistoricalOrderRow[] = [];

  for (let i = 0; i < sessionCount; i += 1) {
    const sessionId = `session-${i}`;
    rows.push(
      {
        tableSessionId: sessionId,
        productId: BURGER,
        productName: "Burger",
      },
      {
        tableSessionId: sessionId,
        productId: FRIES,
        productName: "Pomfrit",
      }
    );

    if (i % 5 === 0) {
      rows.push({
        tableSessionId: sessionId,
        productId: DRINK,
        productName: "Coca Cola",
      });
    }
  }

  return rows;
}

describe("basket analysis G1", () => {
  it("computes high-confidence pairs with minimum sample sessions", () => {
    const pairs = computeBasketPairs(mockSessions(50));

    const burgerFries = pairs.find(
      (pair) => pair.productA === BURGER && pair.productB === FRIES
    );

    expect(burgerFries).toBeDefined();
    expect(burgerFries?.sampleSessions).toBeGreaterThanOrEqual(10);
    expect(burgerFries?.confidencePercent).toBeGreaterThanOrEqual(80);
  });

  it("ignores pairs below minimum sample threshold", () => {
    const pairs = computeBasketPairs(mockSessions(5));
    expect(pairs).toHaveLength(0);
  });

  it("picks learned pair for cart anchor product", () => {
    const pairs = computeBasketPairs(mockSessions(50));
    const picked = pickLearnedPairForCart(pairs, [BURGER]);

    expect(picked?.productBName).toBe("Pomfrit");
  });

  it("formats combined VKG + learned pairing evidence", () => {
    const pairs = computeBasketPairs(mockSessions(50));
    const block = retrieveCombinedPairingEvidence({
      manual: [
        {
          productId: DRINK,
          name: "Aperol Spritz",
          price: 8,
          menuSection: "drinks",
          weight: 0.8,
          reason: "preporučeno uz riblji meni",
          ruleId: null,
        },
      ],
      learned: pairs,
      cartProductIds: [BURGER],
    });

    expect(block).toContain("VKG PAIRING:");
    expect(block).toContain("Pomfrit");
    expect(block).toContain("learned");
    expect(block).toContain("Aperol Spritz");
    expect(block).toContain("manual");
  });

  it("returns top popularity pair for proactive nudge", () => {
    const pairs = computeBasketPairs(mockSessions(50));
    const top = pickTopLearnedPopularityPair(pairs);

    expect(top?.from).toBe("Burger");
    expect(top?.to).toBe("Pomfrit");
  });
});
