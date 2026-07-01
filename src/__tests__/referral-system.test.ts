import { describe, expect, it } from "vitest";
import {
  applyReferralBonusesOnFirstOrder,
  buildDenisReferralPrompt,
  buildReferralShareUrl,
  buildSocialProofMessage,
  countReferralsByReferrer,
  generateReferralCode,
  MAX_REFERRALS_PER_GUEST,
  REFERRAL_BONUS_POINTS,
  registerReferral,
  type LoyaltyReferral,
} from "@/lib/denis/commerce/loyalty/referral-system";

function makeReferral(
  overrides: Partial<LoyaltyReferral> & {
    referrerGuestToken: string;
    referredGuestToken: string;
  }
): LoyaltyReferral {
  return {
    id: crypto.randomUUID(),
    bonusApplied: false,
    referredWelcomeApplied: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("referral-system", () => {
  it("generates stable unique referral codes per guest", () => {
    const codeA = generateReferralCode("guest-token-aaa", "loc-1");
    const codeB = generateReferralCode("guest-token-bbb", "loc-1");
    const codeA2 = generateReferralCode("guest-token-aaa", "loc-1");

    expect(codeA).toMatch(/^VERA-[A-Z0-9]{4}$/);
    expect(codeB).toMatch(/^VERA-[A-Z0-9]{4}$/);
    expect(codeA).toBe(codeA2);
    expect(codeA).not.toBe(codeB);
  });

  it("builds share URL with referral code", () => {
    const url = buildReferralShareUrl({
      baseUrl: "https://example.com",
      slug: "demo",
      tableToken: "qr123",
      referralCode: "VERA-X7K2",
    });

    expect(url).toBe("https://example.com/demo/qr123?ref=VERA-X7K2");
  });

  it("awards both parties on referred guest first order", () => {
    const referrals = [
      makeReferral({
        referrerGuestToken: "referrer-1",
        referredGuestToken: "referred-1",
      }),
    ];

    const result = applyReferralBonusesOnFirstOrder(
      referrals,
      "referred-1",
      "order-1"
    );

    expect(result.referrerGuestToken).toBe("referrer-1");
    expect(result.referrerBonusPoints).toBe(REFERRAL_BONUS_POINTS);
    expect(result.referredBonusPoints).toBe(REFERRAL_BONUS_POINTS);
    expect(result.welcomeDiscountPercent).toBe(10);
    expect(result.updated[0]?.bonusApplied).toBe(true);
    expect(result.updated[0]?.firstOrderId).toBe("order-1");
  });

  it("caps referrals at max per guest", () => {
    const referrer = "referrer-cap";
    const existing: LoyaltyReferral[] = Array.from(
      { length: MAX_REFERRALS_PER_GUEST },
      (_, i) =>
        makeReferral({
          referrerGuestToken: referrer,
          referredGuestToken: `referred-${i}`,
          referredDeviceFingerprint: `device-${i}`,
        })
    );

    const result = registerReferral({
      locationId: "loc-1",
      referrerGuestToken: referrer,
      referredGuestToken: "referred-new",
      referredDeviceFingerprint: "device-new",
      existingReferrals: existing,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("referral_cap");
    }
  });

  it("blocks duplicate device fingerprint", () => {
    const existing = [
      makeReferral({
        referrerGuestToken: "referrer-a",
        referredGuestToken: "referred-a",
        referredDeviceFingerprint: "fp_shared",
      }),
    ];

    const result = registerReferral({
      locationId: "loc-1",
      referrerGuestToken: "referrer-b",
      referredGuestToken: "referred-b",
      referredDeviceFingerprint: "fp_shared",
      existingReferrals: existing,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("duplicate_device");
    }
  });

  it("blocks self referral by token or device", () => {
    const byToken = registerReferral({
      locationId: "loc-1",
      referrerGuestToken: "same",
      referredGuestToken: "same",
      existingReferrals: [],
    });
    expect(byToken.ok).toBe(false);

    const byDevice = registerReferral({
      locationId: "loc-1",
      referrerGuestToken: "a",
      referredGuestToken: "b",
      referrerDeviceFingerprint: "fp1",
      referredDeviceFingerprint: "fp1",
      existingReferrals: [],
    });
    expect(byDevice.ok).toBe(false);
  });

  it("counts referrals by referrer", () => {
    const referrals = [
      makeReferral({ referrerGuestToken: "r1", referredGuestToken: "a" }),
      makeReferral({ referrerGuestToken: "r1", referredGuestToken: "b" }),
      makeReferral({ referrerGuestToken: "r2", referredGuestToken: "c" }),
    ];

    expect(countReferralsByReferrer(referrals, "r1")).toBe(2);
    expect(countReferralsByReferrer(referrals, "r2")).toBe(1);
  });

  it("builds Denis referral prompt and social proof", () => {
    expect(buildDenisReferralPrompt("sr")).toContain("Poznajete");
    expect(buildDenisReferralPrompt("en")).toContain("Share");

    const proof = buildSocialProofMessage({
      friendName: "Marko",
      productName: "Schnitzel",
    });
    expect(proof).toContain("Marko");
    expect(proof).toContain("Schnitzel");
  });
});
