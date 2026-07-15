import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import {
  buildDenisToneGuide,
  buildLoyaltyContextBlock,
  detectLevelUp,
  detectStreak,
  earnPointsFromOrder,
  formatLoyaltyRewardLabel,
  redeemPoints,
  resolveGuestLevel,
  resolveWaitlistPriorityBoost,
  shouldTriggerLevelUpCelebration,
  REDEEM_EURO_VALUE,
  REDEEM_POINTS_COST,
} from "@/lib/denis/commerce/loyalty";
import { loadLoyaltyRewardsForLevel } from "@/lib/denis/commerce/loyalty/loyalty-store";

describe("guest-level", () => {
  it("resolves level 2 Regular after 3 visits", () => {
    const level = resolveGuestLevel({ visitCount: 3, totalSpent: 50 });
    expect(level.id).toBe(2);
    expect(level.badgeLabel).toBe("Regular");
    expect(resolveWaitlistPriorityBoost(level.id)).toBe(1);
  });

  it("resolves VIP by spend threshold", () => {
    const level = resolveGuestLevel({ visitCount: 2, totalSpent: 250 });
    expect(level.id).toBe(3);
    expect(level.badge).toBe("💎");
    expect(resolveWaitlistPriorityBoost(level.id)).toBe(3);
  });

  it("resolves Ambassador at 15 visits", () => {
    const level = resolveGuestLevel({ visitCount: 15, totalSpent: 100 });
    expect(level.id).toBe(4);
    expect(level.badgeLabel).toBe("Ambassador");
    expect(resolveWaitlistPriorityBoost(level.id)).toBe(5);
  });
});

describe("points-engine", () => {
  it("redeems 100 points for €5 off", () => {
    const result = redeemPoints(100);
    expect(result.ok).toBe(true);
    expect(result.discountEuros).toBe(REDEEM_EURO_VALUE);
    expect(result.newBalance).toBe(0);
    expect(REDEEM_POINTS_COST).toBe(100);
  });

  it("rejects redeem below threshold", () => {
    const result = redeemPoints(50);
    expect(result.ok).toBe(false);
    expect(result.newBalance).toBe(50);
  });

  it("applies 2× points multiplier on streak x4 (4 visits in 30 days)", () => {
    const now = new Date("2026-06-28T12:00:00Z");
    const visitDates = [
      "2026-06-27T12:00:00Z",
      "2026-06-20T12:00:00Z",
      "2026-06-10T12:00:00Z",
      "2026-06-01T12:00:00Z",
    ];
    const streak = detectStreak(visitDates, now);
    expect(streak.tier).toBe(4);
    expect(streak.multiplier).toBe(2);

    const earned = earnPointsFromOrder(
      {
        orderTotalEuros: 50,
        isFirstVisit: false,
        isBirthday: false,
        streakTier: streak.tier,
      },
      0
    );

    expect(earned.totalEarned).toBe(100);
  });
});

describe("streak-tracker", () => {
  it("detects streak x2 for 2 visits in 14 days", () => {
    const now = new Date("2026-06-28T12:00:00Z");
    const streak = detectStreak(
      ["2026-06-27T12:00:00Z", "2026-06-20T12:00:00Z"],
      now
    );
    expect(streak.tier).toBe(2);
    expect(streak.label).toContain("streak x2");
  });
});

describe("Denis loyalty integration", () => {
  it("level 1 vs level 4 produce different Denis tone guides", () => {
    const level1 = resolveGuestLevel({ visitCount: 1, totalSpent: 20 });
    const level4 = resolveGuestLevel({ visitCount: 20, totalSpent: 600 });

    const tone1 = buildDenisToneGuide(level1);
    const tone4 = buildDenisToneGuide(level4);

    expect(tone1).toContain("formal");
    expect(tone4).toContain("casual");
    expect(tone1).not.toBe(tone4);
  });

  it("includes LOYALTY CONTEXT in situation pack", () => {
    const pack = buildSituationPack({
      beliefs: beliefGraph([]),
      loyaltyContext: {
        visitCount: 5,
        totalSpent: 180,
        pointsBalance: 42,
        visitDates: ["2026-06-20T12:00:00Z", "2026-06-10T12:00:00Z"],
      },
    });

    expect(pack).toContain("LOYALTY CONTEXT:");
    expect(pack).toContain("guest_level:");
    expect(pack).toContain("points_balance: 42");
    expect(pack).toContain("next_level_progress:");
  });

  it("level-up triggers celebration", () => {
    const event = detectLevelUp(2, { visitCount: 7, totalSpent: 50 });
    expect(event).not.toBeNull();
    expect(event?.newLevel).toBe(3);
    expect(event?.celebrationMessage).toContain("VIP");

    expect(
      shouldTriggerLevelUpCelebration({
        visitCount: 7,
        totalSpent: 50,
        pointsBalance: 0,
        previousLevel: 2,
      })
    ).toBe(true);
  });

  it("buildLoyaltyContextBlock marks level-up celebration in pack", () => {
    const block = buildLoyaltyContextBlock({
      visitCount: 7,
      totalSpent: 50,
      pointsBalance: 120,
      previousLevel: 2,
    });
    expect(block).toContain("level_up_celebration: YES");
    expect(block).toContain("confetti");
  });
});

describe("loyalty_rewards lookup", () => {
  it("formatLoyaltyRewardLabel produces a human label for known reward types", () => {
    expect(
      formatLoyaltyRewardLabel({ rewardType: "free_dessert", rewardValue: "monthly" })
    ).toContain("dezert");
    expect(
      formatLoyaltyRewardLabel(
        { rewardType: "waitlist_priority", rewardValue: "+3" },
        "en"
      )
    ).toBe("Waitlist priority +3");
  });

  it("formatLoyaltyRewardLabel falls back to raw type:value for unknown reward types", () => {
    expect(
      formatLoyaltyRewardLabel({ rewardType: "custom_thing", rewardValue: "xyz" })
    ).toBe("custom_thing: xyz");
  });

  it("loadLoyaltyRewardsForLevel prefers a location-specific row over the platform default", async () => {
    const or = vi.fn().mockResolvedValue({
      data: [
        { location_id: null, reward_type: "free_dessert", reward_value: "monthly" },
        { location_id: "loc-1", reward_type: "free_dessert", reward_value: "weekly" },
        { location_id: null, reward_type: "secret_menu", reward_value: "access" },
      ],
      error: null,
    });
    const eq2 = vi.fn(() => ({ or }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const rewards = await loadLoyaltyRewardsForLevel(admin, "loc-1", 3);

    expect(rewards).toEqual(
      expect.arrayContaining([
        { rewardType: "free_dessert", rewardValue: "weekly" },
        { rewardType: "secret_menu", rewardValue: "access" },
      ])
    );
    expect(rewards).toHaveLength(2);
  });

  it("loadLoyaltyRewardsForLevel returns an empty array when the query errors", async () => {
    const or = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const eq2 = vi.fn(() => ({ or }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const rewards = await loadLoyaltyRewardsForLevel(admin, "loc-1", 3);
    expect(rewards).toEqual([]);
  });
});
