export const REFERRAL_BONUS_POINTS = 10;
export const REFERRED_WELCOME_DISCOUNT_PERCENT = 10;
export const MAX_REFERRALS_PER_GUEST = 10;

const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type LoyaltyReferral = {
  id: string;
  referrerGuestToken: string;
  referredGuestToken: string;
  referrerDeviceFingerprint?: string;
  referredDeviceFingerprint?: string;
  referralCode?: string;
  bonusApplied: boolean;
  referredWelcomeApplied: boolean;
  firstOrderId?: string;
  createdAt: string;
};

export type RegisterReferralInput = {
  locationId: string;
  referrerGuestToken: string;
  referredGuestToken: string;
  referrerDeviceFingerprint?: string;
  referredDeviceFingerprint?: string;
  referralCode?: string;
  existingReferrals: LoyaltyReferral[];
};

export type RegisterReferralResult =
  | { ok: true; referral: LoyaltyReferral }
  | {
      ok: false;
      reason:
        | "self_referral"
        | "already_referred"
        | "referral_cap"
        | "duplicate_device";
    };

export type ReferralFirstOrderBonusResult = {
  updated: LoyaltyReferral[];
  referrerGuestToken: string | null;
  referrerBonusPoints: number;
  referredBonusPoints: number;
  welcomeDiscountPercent: number;
};

/** Deterministic short code per guest — stable across sessions. */
export function generateReferralCode(
  guestToken: string,
  locationId: string
): string {
  const raw = `${locationId}:${guestToken}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }

  let code = "VERA-";
  let h = Math.abs(hash);
  for (let i = 0; i < 4; i++) {
    code += REFERRAL_CODE_CHARS[h % REFERRAL_CODE_CHARS.length];
    h = Math.floor(h / REFERRAL_CODE_CHARS.length) || Math.abs(hash + i);
  }
  return code;
}

export function countReferralsByReferrer(
  referrals: LoyaltyReferral[],
  referrerGuestToken: string
): number {
  return referrals.filter((row) => row.referrerGuestToken === referrerGuestToken)
    .length;
}

export function registerReferral(
  input: RegisterReferralInput
): RegisterReferralResult {
  const {
    referrerGuestToken,
    referredGuestToken,
    referrerDeviceFingerprint,
    referredDeviceFingerprint,
  } = input;

  if (
    referrerGuestToken === referredGuestToken ||
    (referrerDeviceFingerprint &&
      referredDeviceFingerprint &&
      referrerDeviceFingerprint === referredDeviceFingerprint)
  ) {
    return { ok: false, reason: "self_referral" };
  }

  const existingByGuest = input.existingReferrals.find(
    (row) => row.referredGuestToken === referredGuestToken
  );
  if (existingByGuest) {
    return { ok: false, reason: "already_referred" };
  }

  if (referredDeviceFingerprint) {
    const existingByDevice = input.existingReferrals.find(
      (row) => row.referredDeviceFingerprint === referredDeviceFingerprint
    );
    if (existingByDevice) {
      return { ok: false, reason: "duplicate_device" };
    }
  }

  const referrerCount = countReferralsByReferrer(
    input.existingReferrals,
    referrerGuestToken
  );
  if (referrerCount >= MAX_REFERRALS_PER_GUEST) {
    return { ok: false, reason: "referral_cap" };
  }

  const referral: LoyaltyReferral = {
    id: crypto.randomUUID(),
    referrerGuestToken,
    referredGuestToken,
    referrerDeviceFingerprint,
    referredDeviceFingerprint,
    referralCode: input.referralCode,
    bonusApplied: false,
    referredWelcomeApplied: false,
    createdAt: new Date().toISOString(),
  };

  return { ok: true, referral };
}

export function findPendingReferralForReferred(
  referrals: LoyaltyReferral[],
  referredGuestToken: string
): LoyaltyReferral | null {
  return (
    referrals.find(
      (row) =>
        row.referredGuestToken === referredGuestToken && !row.bonusApplied
    ) ?? null
  );
}

export function isReferredWelcomeEligible(
  referrals: LoyaltyReferral[],
  referredGuestToken: string
): boolean {
  const row = referrals.find(
    (r) => r.referredGuestToken === referredGuestToken
  );
  return !!row && !row.referredWelcomeApplied;
}

export function calculateReferralWelcomeDiscount(
  orderTotalEuros: number,
  eligible: boolean
): number {
  if (!eligible || orderTotalEuros <= 0) return 0;
  return (
    Math.round(orderTotalEuros * REFERRED_WELCOME_DISCOUNT_PERCENT) / 100
  );
}

export function applyReferralBonusesOnFirstOrder(
  referrals: LoyaltyReferral[],
  referredGuestToken: string,
  orderId: string
): ReferralFirstOrderBonusResult {
  const pending = findPendingReferralForReferred(referrals, referredGuestToken);

  if (!pending) {
    return {
      updated: referrals,
      referrerGuestToken: null,
      referrerBonusPoints: 0,
      referredBonusPoints: 0,
      welcomeDiscountPercent: 0,
    };
  }

  const updated = referrals.map((row) => {
    if (row.id !== pending.id) return row;
    return {
      ...row,
      bonusApplied: true,
      referredWelcomeApplied: true,
      firstOrderId: orderId,
    };
  });

  return {
    updated,
    referrerGuestToken: pending.referrerGuestToken,
    referrerBonusPoints: REFERRAL_BONUS_POINTS,
    referredBonusPoints: REFERRAL_BONUS_POINTS,
    welcomeDiscountPercent: REFERRED_WELCOME_DISCOUNT_PERCENT,
  };
}

export function applyReferralBonus(
  referrals: LoyaltyReferral[],
  referrerGuestToken: string
): { updated: LoyaltyReferral[]; bonusCount: number } {
  let bonusCount = 0;
  const updated = referrals.map((row) => {
    if (row.referrerGuestToken !== referrerGuestToken || row.bonusApplied) {
      return row;
    }
    bonusCount += 1;
    return { ...row, bonusApplied: true };
  });
  return { updated, bonusCount };
}

export function buildReferralShareUrl(input: {
  baseUrl: string;
  slug: string;
  tableToken: string;
  referralCode: string;
}): string {
  const url = new URL(
    `${input.baseUrl.replace(/\/$/, "")}/${input.slug}/${input.tableToken}`
  );
  url.searchParams.set("ref", input.referralCode);
  return url.toString();
}

export function buildReferralShareMessage(input: {
  venueName: string;
  shareUrl: string;
  bonusPoints?: number;
  language?: string;
}): string {
  const bonus = input.bonusPoints ?? REFERRAL_BONUS_POINTS;
  const lang = (input.language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return `Join me at ${input.venueName}! We both get ${bonus} bonus points: ${input.shareUrl}`;
  }
  if (lang === "de") {
    return `Komm mit zu ${input.venueName}! Wir bekommen beide ${bonus} Bonuspunkte: ${input.shareUrl}`;
  }
  return `Dođi u ${input.venueName}! Oboje dobijamo ${bonus} bonus poena: ${input.shareUrl}`;
}

export function buildDenisReferralPrompt(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return "Know someone who loves good food? Share our link — you both get bonus points!";
  }
  if (lang === "de") {
    return "Kennst du jemanden, der gutes Essen liebt? Teile unseren Link — ihr bekommt beide Bonuspunkte!";
  }
  return "Poznajete nekoga ko voli dobru hranu? Podelite naš link — oboje dobijate bonus poene!";
}

export function buildSocialProofMessage(input: {
  friendName: string;
  productName?: string;
  language?: string;
}): string | null {
  const name = input.friendName.trim();
  if (!name) return null;

  const lang = (input.language ?? "sr").slice(0, 2);
  const product = input.productName?.trim();

  if (lang === "en") {
    return product
      ? `Your friend ${name} says the ${product} is excellent!`
      : `Your friend ${name} recommends this place!`;
  }
  if (lang === "de") {
    return product
      ? `Dein Freund ${name} sagt, das ${product} ist ausgezeichnet!`
      : `Dein Freund ${name} empfiehlt diesen Ort!`;
  }
  return product
    ? `Vaš prijatelj ${name} kaže da je ${product} odličan!`
    : `Vaš prijatelj ${name} preporučuje ovo mesto!`;
}

export type ReferralDashboardRow = {
  referrerGuestToken: string;
  referralCount: number;
  convertedCount: number;
  conversionRate: number;
  revenueEuros: number;
};

export type ReferralDashboardStats = {
  totalReferrals: number;
  totalConverted: number;
  overallConversionRate: number;
  totalRevenueEuros: number;
  topReferrers: ReferralDashboardRow[];
};

export function aggregateReferralDashboardStats(input: {
  referrals: LoyaltyReferral[];
  orderTotalsById: Record<string, number>;
}): ReferralDashboardStats {
  const byReferrer = new Map<
    string,
    { count: number; converted: number; revenue: number }
  >();

  for (const row of input.referrals) {
    const bucket = byReferrer.get(row.referrerGuestToken) ?? {
      count: 0,
      converted: 0,
      revenue: 0,
    };
    bucket.count += 1;
    if (row.bonusApplied) {
      bucket.converted += 1;
      if (row.firstOrderId) {
        bucket.revenue += input.orderTotalsById[row.firstOrderId] ?? 0;
      }
    }
    byReferrer.set(row.referrerGuestToken, bucket);
  }

  const topReferrers: ReferralDashboardRow[] = [...byReferrer.entries()]
    .map(([referrerGuestToken, stats]) => ({
      referrerGuestToken,
      referralCount: stats.count,
      convertedCount: stats.converted,
      conversionRate:
        stats.count > 0
          ? Math.round((stats.converted / stats.count) * 100)
          : 0,
      revenueEuros: Math.round(stats.revenue * 100) / 100,
    }))
    .sort((a, b) => b.referralCount - a.referralCount || b.revenueEuros - a.revenueEuros)
    .slice(0, 10);

  const totalReferrals = input.referrals.length;
  const totalConverted = input.referrals.filter((r) => r.bonusApplied).length;
  const totalRevenueEuros = input.referrals.reduce((sum, row) => {
    if (!row.bonusApplied || !row.firstOrderId) return sum;
    return sum + (input.orderTotalsById[row.firstOrderId] ?? 0);
  }, 0);

  return {
    totalReferrals,
    totalConverted,
    overallConversionRate:
      totalReferrals > 0
        ? Math.round((totalConverted / totalReferrals) * 100)
        : 0,
    totalRevenueEuros: Math.round(totalRevenueEuros * 100) / 100,
    topReferrers,
  };
}
