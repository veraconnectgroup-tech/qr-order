import { describe, expect, it, vi } from "vitest";
import {
  computePlatformMrr,
  extendTrialEndDate,
  resolvePlanChangeDirection,
} from "@/lib/billing/invoicing";
import { handleBillingLowBalance } from "@/lib/outbox/handlers/billing-low-balance";
import {
  collectEvalEdgeCases,
  computeEvalQualityTrend,
  computeOrgQualityScore,
  rankOrgDenisScores,
} from "@/lib/platform/denis-eval-dashboard";
import { orgTrialStatus } from "@/lib/platform/platform-stats";

describe("Platform admin — org status", () => {
  it("lists 10 orgs with correct trial status", () => {
    const now = Date.now();
    const orgs = [
      { onboarding_completed: false, trial_ends_at: null },
      { onboarding_completed: true, trial_ends_at: null },
      {
        onboarding_completed: true,
        trial_ends_at: new Date(now + 7 * 86400000).toISOString(),
      },
      {
        onboarding_completed: true,
        trial_ends_at: new Date(now - 86400000).toISOString(),
      },
      { onboarding_completed: true, trial_ends_at: null },
      {
        onboarding_completed: true,
        trial_ends_at: new Date(now + 86400000).toISOString(),
      },
      { onboarding_completed: false, trial_ends_at: null },
      {
        onboarding_completed: true,
        trial_ends_at: new Date(now - 2 * 86400000).toISOString(),
      },
      { onboarding_completed: true, trial_ends_at: null },
      {
        onboarding_completed: true,
        trial_ends_at: new Date(now + 14 * 86400000).toISOString(),
      },
    ];

    const statuses = orgs.map(orgTrialStatus);
    expect(statuses).toEqual([
      "setup",
      "active",
      "trial",
      "expired",
      "active",
      "trial",
      "setup",
      "expired",
      "active",
      "trial",
    ]);
  });
});

describe("Platform admin — billing", () => {
  it("extends trial from current end date", () => {
    const current = "2026-07-01T00:00:00.000Z";
    const next = extendTrialEndDate(current, 7);
    expect(new Date(next).toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("computes MRR from active subscriptions", () => {
    const plans = [
      {
        id: "starter",
        name: "Starter",
        price_cents: 4900,
        currency: "EUR",
        interval: "month" as const,
        features: [],
        sort_order: 1,
        is_active: true,
      },
      {
        id: "pro",
        name: "Pro",
        price_cents: 9900,
        currency: "EUR",
        interval: "month" as const,
        features: [],
        sort_order: 2,
        is_active: true,
      },
    ];

    const mrr = computePlatformMrr(
      [
        { plan_id: "starter", subscription_status: "active" },
        { plan_id: "pro", subscription_status: "trialing" },
        { plan_id: "pro", subscription_status: "canceled" },
      ],
      plans
    );
    expect(mrr).toBe(14800);
  });

  it("detects plan upgrade vs downgrade", () => {
    const plans = [
      {
        id: "starter",
        name: "Starter",
        price_cents: 4900,
        currency: "EUR",
        interval: "month" as const,
        features: [],
        sort_order: 1,
        is_active: true,
      },
      {
        id: "pro",
        name: "Pro",
        price_cents: 9900,
        currency: "EUR",
        interval: "month" as const,
        features: [],
        sort_order: 2,
        is_active: true,
      },
    ];

    expect(resolvePlanChangeDirection("starter", "pro", plans)).toBe("upgrade");
    expect(resolvePlanChangeDirection("pro", "starter", plans)).toBe("downgrade");
    expect(resolvePlanChangeDirection("starter", "starter", plans)).toBe("same");
  });

  it("notifies staff on low balance via outbox handler", async () => {
    const pushModule = await import("@/lib/push/notify-location");
    vi.spyOn(pushModule, "notifyLocationPush").mockResolvedValue({
      sent: 2,
      failed: 0,
      removed: 0,
      targeted: 2,
    });

    await handleBillingLowBalance({
      orgId: "org-1",
      locationId: "loc-1",
      balance: 5,
      threshold: 10,
      traceId: "trace-1",
    });

    expect(pushModule.notifyLocationPush).toHaveBeenCalledWith(
      "loc-1",
      expect.objectContaining({
        title: "Denis AI credits low",
        body: expect.stringContaining("5 credits left"),
        url: "/admin/ai",
      })
    );
  });
});

describe("Platform admin — Denis eval dashboard", () => {
  it("ranks cross-org scores highest first", () => {
    const ranked = rankOrgDenisScores([
      {
        orgId: "a",
        orgName: "Alpha",
        slug: "alpha",
        qualityScore: 72,
        turns24h: 10,
        conversionRate: 0.4,
        experienceScore: 70,
        lowBalance: false,
      },
      {
        orgId: "b",
        orgName: "Beta",
        slug: "beta",
        qualityScore: 91,
        turns24h: 20,
        conversionRate: 0.6,
        experienceScore: 88,
        lowBalance: false,
      },
    ]);

    expect(ranked[0]?.orgId).toBe("b");
    expect(ranked[1]?.orgId).toBe("a");
  });

  it("computes org quality score with low-balance penalty", () => {
    expect(
      computeOrgQualityScore({
        conversionRate: 0.55,
        experienceScore: 82,
        lowBalance: false,
      })
    ).toBe(82);

    expect(
      computeOrgQualityScore({
        conversionRate: 0.55,
        experienceScore: 82,
        lowBalance: true,
      })
    ).toBe(77);
  });

  it("builds global eval quality trend", () => {
    const trend = computeEvalQualityTrend([
      {
        createdAt: "2026-06-01T10:00:00.000Z",
        passed: 8,
        scenarioCount: 10,
      },
      {
        createdAt: "2026-06-01T12:00:00.000Z",
        passed: 9,
        scenarioCount: 10,
      },
      {
        createdAt: "2026-06-02T08:00:00.000Z",
        passed: 10,
        scenarioCount: 10,
      },
    ]);

    expect(trend).toHaveLength(2);
    expect(trend[0]?.passRate).toBe(85);
    expect(trend[1]?.passRate).toBe(100);
  });

  it("collects recurring eval edge cases", () => {
    const edgeCases = collectEvalEdgeCases([
      {
        results: [
          {
            scenarioId: "drinks_upsell_guard",
            passed: false,
            errors: ["wrong flow node"],
          },
          {
            scenarioId: "drinks_upsell_guard",
            passed: false,
            errors: ["timeout"],
          },
          { scenarioId: "allergy_block", passed: true, errors: [] },
        ],
      },
    ]);

    expect(edgeCases[0]?.scenarioId).toBe("drinks_upsell_guard");
    expect(edgeCases[0]?.failCount).toBe(2);
    expect(edgeCases[0]?.lastError).toBe("timeout");
  });
});
