import { buildEngagementMessage } from "@/lib/denis/retention/build-engagement-message";
import {
  daysSinceLastVisit,
  filterEngagementTriggersForSend,
  resolveEngagementChannel,
  resolveEngagementTriggers,
  type EngagementMessage,
} from "@/lib/denis/retention/guest-engagement-loop";
import type { EventConfig } from "@/lib/denis/venue/ops/event-mode";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { EngagementMenuProduct } from "@/lib/denis/retention/guest-engagement-loop";

/** Plan outbound engagement messages for one guest (Q2). */
export function planGuestEngagementMessages(input: {
  guest: GuestMemoryProjection;
  newMenuItems: EngagementMenuProduct[];
  upcomingEvents: EventConfig[];
  engagementConsentAt: string | null;
  messagesSentThisMonth: number;
  winBackAlreadySent: boolean;
  birthdayMonth?: number | null;
  hasPushSubscription?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  preferredChannel?: "push" | "whatsapp" | "sms" | "email" | null;
  language?: string;
  nowMs?: number;
}): EngagementMessage[] {
  const nowMs = input.nowMs ?? Date.now();
  const daysAway = daysSinceLastVisit(input.guest.lastVisitAt, nowMs);

  const triggers = resolveEngagementTriggers({
    guest: input.guest,
    daysSinceLastVisit: daysAway,
    newMenuItems: input.newMenuItems,
    upcomingEvents: input.upcomingEvents,
    birthdayMonth: input.birthdayMonth ?? null,
    winBackAlreadySent: input.winBackAlreadySent,
    nowMs,
  });

  const sendable = filterEngagementTriggersForSend({
    triggers,
    engagementConsentAt: input.engagementConsentAt,
    messagesSentThisMonth: input.messagesSentThisMonth,
    winBackAlreadySent: input.winBackAlreadySent,
    nowMs,
  });

  const channel = resolveEngagementChannel({
    hasPushSubscription: input.hasPushSubscription,
    hasEmail: input.hasEmail,
    hasPhone: input.hasPhone,
    preferredChannel: input.preferredChannel,
  });

  return sendable.map((trigger) =>
    buildEngagementMessage({
      trigger,
      channel,
      guest: input.guest,
      newMenuItems: input.newMenuItems,
      upcomingEvents: input.upcomingEvents,
      language: input.language,
      sentAt: new Date(nowMs).toISOString(),
    })
  );
}
