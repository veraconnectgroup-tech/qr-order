import { describe, expect, it } from "vitest";
import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import { buildCapacityBannerForView } from "@/lib/denis/venue/ops/build-capacity-banner-for-view";
import {
  CAPACITY_REFRESH_BUCKET_MS,
  mergeCapacityPlannerEffects,
  quantizeCapacityNowMs,
  resolveCapacityBanner,
} from "@/lib/denis/venue/ops/capacity-banner";
import type { TableSessionState } from "@/lib/denis/loop/types";

describe("resolveCapacityBanner", () => {
  it("returns green with no banner when wait is under 10 minutes", () => {
    const banner = resolveCapacityBanner({
      stationQueues: [],
      activeOrderCount: 4,
      avgPrepMinutes: 18,
      rushMode: false,
    });

    expect(banner.level).toBe("green");
    expect(banner.showBanner).toBe(false);
    expect(banner.message).toBe("");
  });

  it("shows yellow banner for 12 active orders and avgPrep 18min", () => {
    const banner = resolveCapacityBanner({
      stationQueues: [],
      activeOrderCount: 12,
      avgPrepMinutes: 18,
      rushMode: false,
    });

    expect(banner.level).toBe("yellow");
    expect(banner.showBanner).toBe(true);
    expect(banner.estimatedWaitMinutes).toBe(18);
    expect(banner.message).toContain("🟡");
    expect(banner.message).toContain("~18 min");
  });

  it("shows red banner when estimated wait exceeds 20 minutes", () => {
    const banner = resolveCapacityBanner({
      stationQueues: [],
      activeOrderCount: 20,
      avgPrepMinutes: 18,
      rushMode: false,
    });

    expect(banner.level).toBe("red");
    expect(banner.showBanner).toBe(true);
    expect(banner.message).toContain("🔴");
    expect(banner.message).toContain("brže opcije");
  });

  it("uses kitchen queue wait when higher than backlog estimate", () => {
    const banner = resolveCapacityBanner({
      stationQueues: [
        {
          station: "kitchen",
          activeOrderCount: 8,
          avgWaitMinutes: 22,
          oldestOrderMinutes: 30,
        },
        {
          station: "bar",
          activeOrderCount: 2,
          avgWaitMinutes: 4,
          oldestOrderMinutes: 5,
        },
      ],
      activeOrderCount: 8,
      avgPrepMinutes: 12,
      rushMode: false,
    });

    expect(banner.level).toBe("red");
    expect(banner.estimatedWaitMinutes).toBe(22);
  });

  it("bumps green to yellow when rush mode is active", () => {
    const banner = resolveCapacityBanner({
      stationQueues: [],
      activeOrderCount: 2,
      avgPrepMinutes: 12,
      rushMode: true,
    });

    expect(banner.level).toBe("yellow");
    expect(banner.showBanner).toBe(true);
  });
});

describe("quantizeCapacityNowMs", () => {
  it("buckets time to 2-minute refresh cadence", () => {
    expect(quantizeCapacityNowMs(0)).toBe(0);
    expect(quantizeCapacityNowMs(CAPACITY_REFRESH_BUCKET_MS - 1)).toBe(0);
    expect(quantizeCapacityNowMs(CAPACITY_REFRESH_BUCKET_MS)).toBe(
      CAPACITY_REFRESH_BUCKET_MS
    );
  });
});

describe("mergeCapacityPlannerEffects", () => {
  it("sets quick-prep bias for yellow and complex suppression for red", () => {
    const base = {
      skipUpsell: false,
      shortenReplies: false,
      empathyNote: null,
      guestSafeStaffHint: null,
    };

    const yellow = mergeCapacityPlannerEffects(
      base,
      resolveCapacityBanner({
        stationQueues: [],
        activeOrderCount: 12,
        avgPrepMinutes: 18,
        rushMode: false,
      })
    );
    expect(yellow.preferQuickPrep).toBe(true);
    expect(yellow.suppressComplexDishes).toBe(false);

    const red = mergeCapacityPlannerEffects(
      base,
      resolveCapacityBanner({
        stationQueues: [],
        activeOrderCount: 24,
        avgPrepMinutes: 18,
        rushMode: false,
      })
    );
    expect(red.suppressComplexDishes).toBe(true);
    expect(red.empathyNote).toContain("strpljenju");
  });
});

describe("buildCapacityBannerForView", () => {
  it("returns null when capability is disabled", () => {
    const policy = {
      ...DEFAULT_COMMERCE_POLICY,
      capabilities: {
        ...DEFAULT_COMMERCE_POLICY.capabilities,
        "kitchen.capacity_banner": {
          enabled: false,
          rollout: {
            mode: "shadow" as const,
            canaryPercent: 10,
            tableSessionActorEnabled: false,
          },
          params: {},
        },
      },
    };

    const state = {
      session: { id: "any-session" },
      table: { token: "tok" },
      venue: {
        opsEffects: {
          skipUpsell: false,
          shortenReplies: false,
          empathyNote: null,
          guestSafeStaffHint: null,
          capacityBanner: resolveCapacityBanner({
            stationQueues: [],
            activeOrderCount: 12,
            avgPrepMinutes: 18,
            rushMode: false,
          }),
        },
      },
    } as unknown as TableSessionState;

    expect(buildCapacityBannerForView({ state, policy })).toBeNull();
  });

  it("returns banner when capability is active for cohort", () => {
    let cohortKey: string | null = null;
    for (let i = 0; i < 200; i += 1) {
      const candidate = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      if (
        isCommerceCapabilityActive({
          capabilityId: "kitchen.capacity_banner",
          cohortKey: candidate,
        })
      ) {
        cohortKey = candidate;
        break;
      }
    }
    expect(cohortKey).not.toBeNull();

    const banner = resolveCapacityBanner({
      stationQueues: [],
      activeOrderCount: 12,
      avgPrepMinutes: 18,
      rushMode: false,
    });

    const state = {
      session: { id: cohortKey! },
      table: { token: "tok" },
      venue: {
        opsEffects: {
          skipUpsell: false,
          shortenReplies: false,
          empathyNote: null,
          guestSafeStaffHint: null,
          capacityBanner: banner,
        },
      },
    } as unknown as TableSessionState;

    expect(buildCapacityBannerForView({ state })).toEqual(banner);
  });
});
