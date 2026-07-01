import { describe, expect, it } from "vitest";
import {
  calculateLoyalty,
  DEFAULT_LOYALTY_CONFIG,
  shouldOfferLoyaltyToGuest,
} from "@/lib/denis/commerce/loyalty-program";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

function baseMemory(overrides: Partial<GuestMemoryProjection> = {}): GuestMemoryProjection {
  return emptyGuestMemoryProjection({
    visitCount: 5,
    avgSpendCents: 150_000,
    ...overrides,
  });
}

describe("loyalty-program", () => {
  it("calculates Bronze tier from visit history", () => {
    const orders = Array.from({ length: 5 }, (_, i) => ({
      id: `order-${i}`,
      total: 1500,
      createdAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    }));

    const loyalty = calculateLoyalty({
      guestMemory: baseMemory(),
      orders,
      config: DEFAULT_LOYALTY_CONFIG,
      optedIn: true,
    });

    expect(loyalty.points).toBe(75);
    expect(loyalty.tier.name).toBe("Bronze");
    expect(loyalty.nextTierIn).toBe(425);
  });

  it("only offers loyalty to returning guests", () => {
    expect(shouldOfferLoyaltyToGuest(baseMemory({ visitCount: 1 }))).toBe(false);
    expect(shouldOfferLoyaltyToGuest(baseMemory({ visitCount: 2 }))).toBe(true);
  });

  it("returns empty rewards when not opted in", () => {
    const loyalty = calculateLoyalty({
      guestMemory: baseMemory(),
      orders: [{ id: "o1", total: 2000, createdAt: new Date().toISOString() }],
      config: DEFAULT_LOYALTY_CONFIG,
      optedIn: false,
    });
    expect(loyalty.points).toBe(0);
    expect(loyalty.availableRewards).toHaveLength(0);
  });
});
