import type { StreakTier } from "@/lib/denis/commerce/loyalty/streak-tracker";
import { pointsMultiplierFromStreak } from "@/lib/denis/commerce/loyalty/streak-tracker";

export type LoyaltyTransactionType = "earn" | "redeem";

export type LoyaltyEarnReason =
  | "order_spend"
  | "first_visit"
  | "review_click"
  | "referral"
  | "birthday_bonus"
  | "streak_bonus";

export type LoyaltyRedeemReason = "discount_5_eur";

export const POINTS_PER_EURO = 1;
export const FIRST_VISIT_BONUS = 5;
export const REVIEW_BONUS = 3;
export const REFERRAL_BONUS = 10;
export const REDEEM_POINTS_COST = 100;
export const REDEEM_EURO_VALUE = 5;

export type LoyaltyTransaction = {
  type: LoyaltyTransactionType;
  points: number;
  reason: LoyaltyEarnReason | LoyaltyRedeemReason;
  createdAt?: string;
};

export type EarnPointsInput = {
  orderTotalEuros: number;
  isFirstVisit: boolean;
  isBirthday: boolean;
  streakTier: StreakTier;
  includeReviewBonus?: boolean;
  includeReferralBonus?: boolean;
};

export type EarnPointsResult = {
  transactions: LoyaltyTransaction[];
  totalEarned: number;
  newBalance: number;
};

export function earnPointsFromOrder(
  input: EarnPointsInput,
  currentBalance: number
): EarnPointsResult {
  const transactions: LoyaltyTransaction[] = [];
  let basePoints = Math.floor(Math.max(0, input.orderTotalEuros) * POINTS_PER_EURO);

  if (input.isBirthday && basePoints > 0) {
    const bonus = basePoints;
    basePoints *= 2;
    transactions.push({
      type: "earn",
      points: bonus,
      reason: "birthday_bonus",
    });
  }

  if (basePoints > 0) {
    transactions.push({
      type: "earn",
      points: basePoints,
      reason: "order_spend",
    });
  }

  if (input.isFirstVisit) {
    transactions.push({
      type: "earn",
      points: FIRST_VISIT_BONUS,
      reason: "first_visit",
    });
  }

  if (input.includeReviewBonus) {
    transactions.push({
      type: "earn",
      points: REVIEW_BONUS,
      reason: "review_click",
    });
  }

  if (input.includeReferralBonus) {
    transactions.push({
      type: "earn",
      points: REFERRAL_BONUS,
      reason: "referral",
    });
  }

  const multiplier = pointsMultiplierFromStreak(input.streakTier);
  const subtotal = transactions.reduce((sum, row) => sum + row.points, 0);
  const streakBonus =
    multiplier > 1 ? Math.round(subtotal * (multiplier - 1)) : 0;

  if (streakBonus > 0) {
    transactions.push({
      type: "earn",
      points: streakBonus,
      reason: "streak_bonus",
    });
  }

  const totalEarned = transactions.reduce((sum, row) => sum + row.points, 0);

  return {
    transactions,
    totalEarned,
    newBalance: currentBalance + totalEarned,
  };
}

export function canRedeemPoints(balance: number, pointsCost = REDEEM_POINTS_COST): boolean {
  return balance >= pointsCost;
}

export function redeemPoints(
  currentBalance: number,
  pointsCost = REDEEM_POINTS_COST
): {
  ok: boolean;
  transaction?: LoyaltyTransaction;
  newBalance: number;
  discountEuros: number;
} {
  if (!canRedeemPoints(currentBalance, pointsCost)) {
    return { ok: false, newBalance: currentBalance, discountEuros: 0 };
  }

  return {
    ok: true,
    transaction: {
      type: "redeem",
      points: -pointsCost,
      reason: "discount_5_eur",
    },
    newBalance: currentBalance - pointsCost,
    discountEuros: REDEEM_EURO_VALUE,
  };
}

export function buildRedeemConfirmationMessage(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return `Redeemed ${REDEEM_POINTS_COST} points for €${REDEEM_EURO_VALUE} off!`;
  }
  return `Iskorišćeno ${REDEEM_POINTS_COST} poena za popust od €${REDEEM_EURO_VALUE}!`;
}
