import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasChannelConsent,
  isGuestSubscribed,
  isStopKeyword,
  processSmsStopUnsubscribe,
} from "@/lib/notifications/guest-preferences";
import { resolveChannelOrder } from "@/lib/notifications/channel-router";
import {
  buildBirthdaySms,
  buildReservationReminderMessage,
  buildWaitlistTableReadySms,
  buildWinBackSms,
  shouldSendReservationReminder,
} from "@/lib/notifications/templates";
import {
  resolveEngagementChannel,
  resolveEngagementTriggers,
} from "@/lib/denis/retention/guest-engagement-loop";
import { sendSms } from "@/lib/notifications/sms-provider";

vi.mock("@/lib/notifications/sms-provider", () => ({
  sendSms: vi.fn(),
  isSmsConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/notifications/whatsapp-provider", () => ({
  sendWhatsApp: vi.fn(),
  isWhatsAppConfigured: vi.fn(() => true),
}));

describe("notification templates", () => {
  it("waitlist ready SMS matches Prompt 89 copy", () => {
    expect(buildWaitlistTableReadySms({ timeoutMinutes: 5 })).toBe(
      "Vaš sto je spreman! Dođite za 5 minuta ili ćemo ga dodeliti drugom gostu."
    );
  });

  it("reservation reminder includes scheduled time", () => {
    const message = buildReservationReminderMessage({
      scheduledAt: "2026-06-28T20:00:00.000Z",
      language: "sr",
    });
    expect(message).toContain("Podsjetnik");
    expect(message).toMatch(/\d{2}:\d{2}/);
  });

  it("shouldSendReservationReminder fires ~2h before", () => {
    const scheduledAt = "2026-06-28T20:00:00.000Z";
    const nowMs = Date.parse("2026-06-28T18:05:00.000Z");
    expect(
      shouldSendReservationReminder({ scheduledAt, nowMs, leadMinutes: 120 })
    ).toBe(true);
    expect(
      shouldSendReservationReminder({
        scheduledAt,
        nowMs: Date.parse("2026-06-28T12:00:00.000Z"),
        leadMinutes: 120,
      })
    ).toBe(false);
  });

  it("win-back and birthday SMS copy", () => {
    expect(buildWinBackSms("sr")).toContain("-10%");
    expect(buildBirthdaySms("sr")).toContain("Sretan rođendan");
    expect(buildBirthdaySms("sr")).toContain("🎂");
  });
});

describe("channel priority", () => {
  it("orders push before whatsapp before sms when no preference", () => {
    expect(
      resolveChannelOrder({ preferred: null, pushAvailable: true })
    ).toEqual(["push", "whatsapp", "sms"]);
  });

  it("respects preferred whatsapp channel first", () => {
    const order = resolveChannelOrder({
      preferred: "whatsapp",
      pushAvailable: true,
    });
    expect(order[0]).toBe("whatsapp");
  });

  it("resolveEngagementChannel prefers push then sms", () => {
    expect(
      resolveEngagementChannel({
        hasPushSubscription: true,
        hasPhone: true,
      })
    ).toBe("push");
    expect(
      resolveEngagementChannel({
        hasPushSubscription: false,
        hasPhone: true,
      })
    ).toBe("sms");
  });
});

describe("GDPR consent", () => {
  const basePrefs = {
    locationId: "loc-1",
    deviceFingerprint: "fp-1",
    phoneE164: "+491701234567",
    preferredChannel: "sms" as const,
    smsConsentAt: "2026-01-01T00:00:00.000Z",
    whatsappConsentAt: null,
    transactionalConsentAt: "2026-01-01T00:00:00.000Z",
    marketingConsentAt: "2026-01-01T00:00:00.000Z",
    unsubscribedAt: null,
    retentionExpiresAt: null,
  };

  it("requires marketing consent for SMS marketing", () => {
    expect(
      hasChannelConsent(
        { ...basePrefs, marketingConsentAt: null },
        "sms",
        "marketing"
      )
    ).toBe(false);
    expect(hasChannelConsent(basePrefs, "sms", "marketing")).toBe(true);
  });

  it("STOP keyword detected", () => {
    expect(isStopKeyword("STOP")).toBe(true);
    expect(isStopKeyword(" stop ")).toBe(true);
    expect(isStopKeyword("hello")).toBe(false);
  });

  it("unsubscribed guest is not subscribed", () => {
    expect(
      isGuestSubscribed({
        ...basePrefs,
        unsubscribedAt: "2026-06-01T00:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("birthday trigger month", () => {
  it("fires birthday trigger only in matching month", () => {
    const juneMs = Date.UTC(2026, 5, 15, 12, 0, 0);
    const triggers = resolveEngagementTriggers({
      guest: {
        allergies: [],
        favoriteItems: [],
        language: "sr",
        favoriteProductIds: [],
        allergySheetIds: [],
        allergyLabels: [],
        preferredLanguage: "sr",
        preferredMealPattern: null,
        visitCount: 5,
        lastVisitItemNames: [],
        lastVisit: "2026-01-01T00:00:00.000Z",
        lastVisitAt: "2026-01-01T00:00:00.000Z",
        avgSpend: null,
        mood: null,
        engagementConsentAt: "2026-01-01T00:00:00.000Z",
        birthdayMonth: 6,
        winBackSentAt: null,
        engagementMonthCount: 0,
      },
      daysSinceLastVisit: 10,
      newMenuItems: [],
      upcomingEvents: [],
      birthdayMonth: 6,
      nowMs: juneMs,
    });
    expect(triggers).toContain("birthday");
  });
});

describe("waitlist ready SMS dispatch", () => {
  beforeEach(() => {
    vi.mocked(sendSms).mockResolvedValue({
      ok: true,
      provider: "twilio",
      messageId: "SM123",
    });
  });

  it("sendSms delivers waitlist ready message", async () => {
    const body = buildWaitlistTableReadySms({ timeoutMinutes: 5 });
    const result = await sendSms({
      to: "+491701234567",
      body,
      templateId: "waitlist.table_ready",
    });
    expect(result).toMatchObject({ ok: true });
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+491701234567",
        templateId: "waitlist.table_ready",
      })
    );
  });
});

describe("opt-out processing", () => {
  it("processSmsStopUnsubscribe updates matching phones", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: "pref-1" }],
          error: null,
        }),
      }),
    });

    const admin = {
      from: vi.fn().mockReturnValue({ update }),
    } as never;

    const count = await processSmsStopUnsubscribe(admin, "+491701234567");
    expect(count).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribed_at: expect.any(String) })
    );
  });
});
