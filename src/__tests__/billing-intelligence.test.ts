import { describe, expect, it, vi } from "vitest";
import { computeBillingRoiJustification } from "@/lib/billing/denis-roi";
import { summarizeRevenueShare } from "@/lib/billing/revenue-share";
import { getPlanTierDefinition } from "@/lib/billing/tiers";
import {
  buildTrialEndingGuestMessage,
  buildTrialEndingNotification,
  shouldNotifyTrialEnding,
  trialDaysLeft,
} from "@/lib/billing/trial";
import {
  buildUsageExceededNotification,
  evaluateUsageAgainstLimits,
} from "@/lib/billing/usage";
import { handleBillingTrialEnding } from "@/lib/outbox/handlers/billing-trial-ending";
import { handleBillingUsageExceeded } from "@/lib/outbox/handlers/billing-usage-exceeded";

describe("Billing intelligence — trial", () => {
  it("notifies when 3 days of trial remain", () => {
    const trialEndsAt = new Date(Date.now() + 3 * 86400000).toISOString();
    expect(shouldNotifyTrialEnding(trialEndsAt, "trialing")).toBe(true);
    expect(shouldNotifyTrialEnding(trialEndsAt, "active")).toBe(false);
  });

  it("builds Denis trial ending guest message", () => {
    expect(buildTrialEndingGuestMessage(3)).toBe(
      "Ostalo vam je 3 dana trial-a! Upgrade za nastavak."
    );
    expect(buildTrialEndingGuestMessage(1)).toBe(
      "Ostalo vam je 1 dan trial-a! Upgrade za nastavak."
    );
  });

  it("delivers trial ending staff notification via outbox handler", async () => {
    const pushModule = await import("@/lib/push/notify-location");
    vi.spyOn(pushModule, "notifyLocationPush").mockResolvedValue({
      sent: 1,
      failed: 0,
      removed: 0,
      targeted: 1,
    });

    await handleBillingTrialEnding({
      orgId: "org-1",
      locationId: "loc-1",
      daysLeft: 3,
    });

    expect(pushModule.notifyLocationPush).toHaveBeenCalledWith(
      "loc-1",
      expect.objectContaining({
        title: "Denis trial ending soon",
        body: expect.stringContaining("Ostalo vam je 3 dana trial-a"),
        url: "/dashboard/billing",
      })
    );
  });

  it("computes trial days left", () => {
    const ends = new Date(Date.now() + 2.2 * 86400000).toISOString();
    expect(trialDaysLeft(ends)).toBe(3);
  });
});

describe("Billing intelligence — usage", () => {
  it("flags Denis LLM usage exceeded and recommends upgrade", () => {
    const evaluation = evaluateUsageAgainstLimits(
      {
        periodStart: "",
        periodEnd: "",
        denisLlmCalls: 520,
        ordersProcessed: 100,
        activeSessions: 40,
        storageMb: 100,
      },
      "starter"
    );

    expect(evaluation.anyExceeded).toBe(true);
    expect(evaluation.upgradeRecommended).toBe(true);
    expect(evaluation.exceededKeys).toContain("denisLlmCalls");
  });

  it("delivers usage exceeded upgrade prompt via outbox handler", async () => {
    const pushModule = await import("@/lib/push/notify-location");
    vi.spyOn(pushModule, "notifyLocationPush").mockResolvedValue({
      sent: 1,
      failed: 0,
      removed: 0,
      targeted: 1,
    });

    await handleBillingUsageExceeded({
      orgId: "org-1",
      locationId: "loc-1",
      exceededKeys: ["denisLlmCalls"],
    });

    expect(pushModule.notifyLocationPush).toHaveBeenCalledWith(
      "loc-1",
      buildUsageExceededNotification(["denisLlmCalls"])
    );
  });

  it("enterprise tier has unlimited Denis calls", () => {
    const tier = getPlanTierDefinition("enterprise");
    expect(tier.limits.denisLlmCallsPerMonth).toBeNull();

    const evaluation = evaluateUsageAgainstLimits(
      {
        periodStart: "",
        periodEnd: "",
        denisLlmCalls: 50000,
        ordersProcessed: 10000,
        activeSessions: 500,
        storageMb: 1000,
      },
      "enterprise"
    );
    expect(evaluation.anyExceeded).toBe(false);
  });
});

describe("Billing intelligence — ROI", () => {
  it("calculates Denis ROI justification for billing dashboard", () => {
    const roi = computeBillingRoiJustification({
      upsellRevenueEuros: 2340,
      planCostEuros: 99,
      currency: "EUR",
    });

    expect(roi.upsellRevenueEuros).toBe(2340);
    expect(roi.planCostEuros).toBe(99);
    expect(roi.roiMultiplier).toBe(23.6);
    expect(roi.headline).toContain("€2.340");
    expect(roi.detail).toContain("ROI: 23,6x");
    expect(roi.netBenefitEuros).toBe(2241);
  });
});

describe("Billing intelligence — revenue share", () => {
  it("summarizes platform fee on order volume", () => {
    const summary = summarizeRevenueShare(
      [{ total: 100 }, { total: 200 }],
      2.5,
      0
    );
    expect(summary.orderVolume).toBe(300);
    expect(summary.platformFeesCollected).toBe(7.5);
    expect(summary.orderCount).toBe(2);
  });
});

describe("Billing intelligence — trial notification payload", () => {
  it("builds staff notification with billing url", () => {
    const notification = buildTrialEndingNotification(3);
    expect(notification.body).toContain("Upgrade za nastavak");
    expect(notification.url).toBe("/dashboard/billing");
  });
});
