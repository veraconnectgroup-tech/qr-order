export {
  planGuestEngagementMessages,
} from "@/lib/denis/retention/plan-guest-engagement";
export {
  loadEngagementSendContext,
} from "@/lib/denis/retention/load-engagement-send-context";
export {
  runGuestEngagementSendTick,
  runGuestEngagementSendAllLocations,
  type GuestEngagementSendResult,
} from "@/lib/denis/retention/run-guest-engagement-send";
export {
  buildEngagementMessage,
} from "@/lib/denis/retention/build-engagement-message";
export {
  buildRetentionInsight,
  formatRetentionDigestLines,
  type RetentionInsight,
} from "@/lib/denis/retention/retention-intelligence";
export {
  CHURN_RISK_DAYS,
  daysSinceLastVisit,
  filterEngagementTriggersForSend,
  isChurnRiskGuest,
  LOYALTY_MILESTONES,
  MAX_ENGAGEMENT_MESSAGES_PER_MONTH,
  monthKeyFromMs,
  resolveEngagementChannel,
  resolveEngagementTriggers,
  menuSectionDisplayLabel,
  guestBrowseDomain,
  WIN_BACK_MIN_DAYS,
  WIN_BACK_MIN_VISITS,
  type EngagementChannel,
  type EngagementMenuProduct,
  type EngagementMessage,
  type EngagementTrigger,
} from "@/lib/denis/retention/guest-engagement-loop";
