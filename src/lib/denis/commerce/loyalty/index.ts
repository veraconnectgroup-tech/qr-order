export {
  GUEST_LEVELS,
  buildDenisToneGuide,
  buildLevelUpNudge,
  buildNextLevelProgress,
  buildReturningGuestGreeting,
  detectLevelUp,
  formatLoyaltyRewardLabel,
  resolveGuestLevel,
  resolveWaitlistPriorityBoost,
  type GuestLevelDefinition,
  type GuestLevelId,
  type GuestLevelInput,
  type GuestLevelKey,
  type LevelUpEvent,
  type LoyaltyRewardEntry,
  type NextLevelProgress,
} from "@/lib/denis/commerce/loyalty/guest-level";

export {
  POINTS_PER_EURO,
  FIRST_VISIT_BONUS,
  REVIEW_BONUS,
  REFERRAL_BONUS,
  REDEEM_POINTS_COST,
  REDEEM_EURO_VALUE,
  canRedeemPoints,
  earnPointsFromOrder,
  redeemPoints,
  buildRedeemConfirmationMessage,
  type EarnPointsInput,
  type EarnPointsResult,
  type LoyaltyEarnReason,
  type LoyaltyRedeemReason,
  type LoyaltyTransaction,
  type LoyaltyTransactionType,
} from "@/lib/denis/commerce/loyalty/points-engine";

export {
  detectStreak,
  pointsMultiplierFromStreak,
  buildStreakBreakMessage,
  type StreakResult,
  type StreakTier,
} from "@/lib/denis/commerce/loyalty/streak-tracker";

export {
  REFERRAL_BONUS_POINTS,
  REFERRED_WELCOME_DISCOUNT_PERCENT,
  MAX_REFERRALS_PER_GUEST,
  registerReferral,
  applyReferralBonus,
  applyReferralBonusesOnFirstOrder,
  buildReferralShareUrl,
  buildReferralShareMessage,
  buildDenisReferralPrompt,
  buildSocialProofMessage,
  calculateReferralWelcomeDiscount,
  countReferralsByReferrer,
  findPendingReferralForReferred,
  generateReferralCode,
  isReferredWelcomeEligible,
  aggregateReferralDashboardStats,
  type LoyaltyReferral,
  type RegisterReferralInput,
  type RegisterReferralResult,
  type ReferralDashboardStats,
  type ReferralDashboardRow,
  type ReferralFirstOrderBonusResult,
} from "@/lib/denis/commerce/loyalty/referral-system";

export {
  buildLoyaltyContextBlock,
  buildLoyaltyContextSnapshot,
  shouldTriggerLevelUpCelebration,
  type LoyaltyContextInput,
  type LoyaltyContextSnapshot,
} from "@/lib/denis/commerce/loyalty/loyalty-context";

export {
  aggregateLoyaltyDashboardStats,
  type LoyaltyDashboardStats,
  type LoyaltyGuestRow,
} from "@/lib/denis/commerce/loyalty/loyalty-dashboard-stats";
