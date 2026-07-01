import { describe, expect, it } from "vitest";
import { buildEngagementMessage } from "@/lib/denis/retention/build-engagement-message";
import {
  CHURN_RISK_DAYS,
  daysSinceLastVisit,
  filterEngagementTriggersForSend,
  isChurnRiskGuest,
  MAX_ENGAGEMENT_MESSAGES_PER_MONTH,
  monthKeyFromMs,
  resolveEngagementChannel,
  resolveEngagementTriggers,
  WIN_BACK_MIN_DAYS,
  WIN_BACK_MIN_VISITS,
} from "@/lib/denis/retention/guest-engagement-loop";
import { planGuestEngagementMessages } from "@/lib/denis/retention/plan-guest-engagement";
import {
  buildRetentionInsight,
  formatRetentionDigestLines,
} from "@/lib/denis/retention/retention-intelligence";
import { sameAgainQuickReplyLabels } from "@/lib/denis/learning/guest-memory/same-again-chips";
import {
  emptyGuestMemoryProjection,
  type GuestMemoryProjection,
} from "@/lib/denis/platform/guest-memory-types";

function baseGuest(
  overrides: Partial<GuestMemoryProjection> = {}
): GuestMemoryProjection {
  return emptyGuestMemoryProjection(overrides);
}

describe("resolveEngagementTriggers", () => {
  it("returns loyalty_milestone and win_back for visitCount=5 and 35 days away", () => {
    const triggers = resolveEngagementTriggers({
      guest: baseGuest({ visitCount: 5 }),
      daysSinceLastVisit: 35,
      newMenuItems: [],
      upcomingEvents: [],
    });

    expect(triggers).toEqual(["loyalty_milestone", "win_back"]);
  });

  it("fires win_back when visitCount >= 3 and daysSinceLastVisit > 30", () => {
    const triggers = resolveEngagementTriggers({
      guest: baseGuest({ visitCount: 3 }),
      daysSinceLastVisit: WIN_BACK_MIN_DAYS + 1,
      newMenuItems: [],
      upcomingEvents: [],
    });

    expect(triggers).toContain("win_back");
  });

  it("skips win_back when already sent", () => {
    const triggers = resolveEngagementTriggers({
      guest: baseGuest({ visitCount: 5 }),
      daysSinceLastVisit: 35,
      newMenuItems: [],
      upcomingEvents: [],
      winBackAlreadySent: true,
    });

    expect(triggers).not.toContain("win_back");
    expect(triggers).toContain("loyalty_milestone");
  });

  it("fires weekly_special when new menu item matches favorites", () => {
    const triggers = resolveEngagementTriggers({
      guest: baseGuest({
        favoriteProductIds: ["prod-1"],
        lastVisitItemNames: ["Ćevapi"],
      }),
      daysSinceLastVisit: 3,
      newMenuItems: [{ id: "prod-1", name: "Ćevapi specijal" }],
      upcomingEvents: [],
    });

    expect(triggers).toContain("weekly_special");
  });

  it("fires birthday in matching month", () => {
    const nowMs = Date.UTC(2026, 5, 15);
    const triggers = resolveEngagementTriggers({
      guest: baseGuest({ visitCount: 2 }),
      daysSinceLastVisit: 7,
      newMenuItems: [],
      upcomingEvents: [],
      birthdayMonth: 6,
      nowMs,
    });

    expect(triggers).toContain("birthday");
  });

  it("fires weekly_special when new item matches guest category", () => {
    const triggers = resolveEngagementTriggers({
      guest: baseGuest({ preferredMealPattern: "drinks_only" }),
      daysSinceLastVisit: 3,
      newMenuItems: [{ id: "prod-d", name: "Negroni", menuSection: "drinks" }],
      upcomingEvents: [],
    });

    expect(triggers).toContain("weekly_special");
  });
});

describe("filterEngagementTriggersForSend", () => {
  it("requires consent before sending", () => {
    const filtered = filterEngagementTriggersForSend({
      triggers: ["win_back", "loyalty_milestone"],
      engagementConsentAt: null,
      messagesSentThisMonth: 0,
      winBackAlreadySent: false,
    });

    expect(filtered).toEqual([]);
  });

  it("caps at max 2 messages per month", () => {
    const filtered = filterEngagementTriggersForSend({
      triggers: ["birthday", "loyalty_milestone", "win_back", "weekly_special"],
      engagementConsentAt: "2026-01-01T00:00:00.000Z",
      messagesSentThisMonth: 0,
      winBackAlreadySent: false,
    });

    expect(filtered).toHaveLength(MAX_ENGAGEMENT_MESSAGES_PER_MONTH);
    expect(filtered).toEqual(["birthday", "loyalty_milestone"]);
  });

  it("returns empty when monthly cap already reached", () => {
    const filtered = filterEngagementTriggersForSend({
      triggers: ["win_back"],
      engagementConsentAt: "2026-01-01T00:00:00.000Z",
      messagesSentThisMonth: MAX_ENGAGEMENT_MESSAGES_PER_MONTH,
      winBackAlreadySent: false,
    });

    expect(filtered).toEqual([]);
  });

  it("blocks win_back when already sent", () => {
    const filtered = filterEngagementTriggersForSend({
      triggers: ["win_back", "weekly_special"],
      engagementConsentAt: "2026-01-01T00:00:00.000Z",
      messagesSentThisMonth: 0,
      winBackAlreadySent: true,
    });

    expect(filtered).toEqual(["weekly_special"]);
  });
});

describe("planGuestEngagementMessages", () => {
  it("plans personalized messages when consent is granted", () => {
    const nowMs = Date.UTC(2026, 5, 15);
    const lastVisitAt = new Date(nowMs - 35 * 86_400_000).toISOString();

    const messages = planGuestEngagementMessages({
      guest: baseGuest({
        visitCount: 5,
        lastVisitAt,
        lastVisitItemNames: ["Ćevapi"],
      }),
      newMenuItems: [],
      upcomingEvents: [],
      engagementConsentAt: "2026-05-01T00:00:00.000Z",
      messagesSentThisMonth: 0,
      winBackAlreadySent: false,
      hasPushSubscription: true,
      nowMs,
    });

    expect(messages.map((message) => message.trigger)).toEqual([
      "loyalty_milestone",
      "win_back",
    ]);
    expect(messages[0]?.message).toContain("5. poseta");
    expect(messages[1]?.personalizedOffer).toBe("Ćevapi");
  });
});

describe("buildEngagementMessage", () => {
  it("builds Serbian loyalty milestone copy", () => {
    const message = buildEngagementMessage({
      trigger: "loyalty_milestone",
      channel: "push",
      guest: baseGuest({ visitCount: 10 }),
      language: "sr",
    });

    expect(message.message).toContain("10. poseta");
    expect(message.personalizedOffer).toBe("Desert na račun kuće");
  });

  it("builds win-back copy with favorite item", () => {
    const message = buildEngagementMessage({
      trigger: "win_back",
      channel: "push",
      guest: baseGuest({ lastVisitItemNames: ["Ćevapi"] }),
      language: "sr",
    });

    expect(message.message).toBe(
      "Nedostajete nam! -10% na sledeću posetu. Vaš omiljeni Ćevapi vas čeka."
    );
  });

  it("builds birthday copy", () => {
    const message = buildEngagementMessage({
      trigger: "birthday",
      channel: "push",
      guest: baseGuest(),
      language: "sr",
    });

    expect(message.message).toBe("Sretan rođendan! Desert na naš račun 🎂");
  });

  it("builds weekly special with category label", () => {
    const message = buildEngagementMessage({
      trigger: "weekly_special",
      channel: "push",
      guest: baseGuest({
        favoriteProductIds: ["prod-1"],
        preferredMealPattern: "main_only",
      }),
      newMenuItems: [
        { id: "prod-1", name: "Pljeskavica deluxe", menuSection: "food" },
      ],
      language: "sr",
    });

    expect(message.message).toContain("Nova jelo stavka: Pljeskavica deluxe");
    expect(message.message).toContain("mislimo da bi vam se svidela");
  });
});

describe("resolveEngagementChannel", () => {
  it("prefers push when subscription exists", () => {
    expect(
      resolveEngagementChannel({ hasPushSubscription: true, hasEmail: true })
    ).toBe("push");
  });

  it("falls back to email when no push", () => {
    expect(resolveEngagementChannel({ hasEmail: true })).toBe("email");
  });
});

describe("daysSinceLastVisit", () => {
  it("computes whole days since last visit", () => {
    const nowMs = Date.UTC(2026, 5, 15);
    const lastVisitAt = new Date(nowMs - 35 * 86_400_000).toISOString();

    expect(daysSinceLastVisit(lastVisitAt, nowMs)).toBe(35);
  });
});

describe("isChurnRiskGuest", () => {
  it("flags VIP guests absent 45+ days", () => {
    expect(
      isChurnRiskGuest({
        visitCount: 3,
        daysSinceLastVisit: CHURN_RISK_DAYS,
      })
    ).toBe(true);
  });
});

describe("retention intelligence digest", () => {
  it("formats owner digest lines", () => {
    const insight = buildRetentionInsight({
      winBackSent: 15,
      winBackReturned: 4,
      weeklySpecialSent: 8,
      weeklySpecialOrdered: 3,
      churnRiskVipCount: 12,
    });

    const lines = formatRetentionDigestLines(insight);

    expect(lines[0]).toBe("Win-back poslano: 15 gostiju");
    expect(lines[1]).toBe("Vratilo se: 4 (27%)");
    expect(lines[2]).toBe(
      "Weekly special: 8 gostiju → 3 naručilo taj item"
    );
    expect(lines[3]).toContain("Churn risk: 12 VIP gostiju");
  });

  it("returns placeholder when no data", () => {
    const lines = formatRetentionDigestLines(
      buildRetentionInsight({
        winBackSent: 0,
        winBackReturned: 0,
        weeklySpecialSent: 0,
        weeklySpecialOrdered: 0,
        churnRiskVipCount: 0,
      })
    );

    expect(lines).toEqual(["Još nema dovoljno podataka za retention loop."]);
  });
});

describe("monthKeyFromMs", () => {
  it("returns YYYY-MM in UTC", () => {
    expect(monthKeyFromMs(Date.UTC(2026, 0, 15))).toBe("2026-01");
  });
});

describe("same-again chips", () => {
  it("returns Da, isto / Nešto drugo for Serbian", () => {
    expect(sameAgainQuickReplyLabels("sr")).toEqual({
      sameAgain: "Da, isto",
      somethingElse: "Nešto drugo",
    });
  });
});
