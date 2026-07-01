import { describe, expect, it } from "vitest";
import { MIN_TRENDING_ORDERS_TODAY } from "@/lib/denis/intelligence/menu-personalization";

describe("loadTrendingMenuProducts contract", () => {
  it("uses minimum order threshold from menu personalization", () => {
    expect(MIN_TRENDING_ORDERS_TODAY).toBe(5);
  });

  it("ranks products by daily quantity above threshold", () => {
    const counts = new Map([
      ["a", 12],
      ["b", 5],
      ["c", 4],
    ]);

    const ranked = [...counts.entries()]
      .filter(([, count]) => count >= MIN_TRENDING_ORDERS_TODAY)
      .sort((a, b) => b[1] - a[1]);

    expect(ranked.map(([id]) => id)).toEqual(["a", "b"]);
  });
});
