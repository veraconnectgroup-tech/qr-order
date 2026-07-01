import type { EventConfig } from "@/lib/denis/venue/ops/event-mode";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

export type EngagementTrigger =
  | "weekly_special"
  | "birthday"
  | "win_back"
  | "event_invite"
  | "loyalty_milestone";

export type EngagementChannel = "email" | "push" | "sms";

export type EngagementMenuProduct = {
  id: string;
  name: string;
  menuSection?: string | null;
};

export type EngagementMessage = {
  trigger: EngagementTrigger;
  channel: EngagementChannel;
  message: string;
  personalizedOffer: string | null;
  sentAt: string;
};

export const WIN_BACK_MIN_DAYS = 30;
export const WIN_BACK_MIN_VISITS = 3;
export const LOYALTY_MILESTONES = [5, 10, 20] as const;
export const MAX_ENGAGEMENT_MESSAGES_PER_MONTH = 2;
export const CHURN_RISK_DAYS = 45;

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function productMatchesGuestFavorites(
  product: EngagementMenuProduct,
  guest: GuestMemoryProjection
): boolean {
  if (guest.favoriteProductIds.includes(product.id)) return true;
  const name = normalizeName(product.name);
  return guest.lastVisitItemNames.some(
    (item) =>
      normalizeName(item) === name ||
      name.includes(normalizeName(item)) ||
      normalizeName(item).includes(name)
  );
}

function productMatchesGuestCategory(
  product: EngagementMenuProduct,
  guest: GuestMemoryProjection
): boolean {
  const domain = guestBrowseDomain(guest);
  if (!domain) return false;
  const section = (product.menuSection ?? "").toLowerCase();
  return section === domain;
}

function productMatchesGuestInterest(
  product: EngagementMenuProduct,
  guest: GuestMemoryProjection
): boolean {
  return (
    productMatchesGuestFavorites(product, guest) ||
    productMatchesGuestCategory(product, guest)
  );
}

/** Human-readable menu section for weekly-special copy. */
export function menuSectionDisplayLabel(
  menuSection: string | null | undefined,
  guest: GuestMemoryProjection,
  language: string
): string {
  const lang = language.slice(0, 2).toLowerCase();
  const section =
    (menuSection ?? guestBrowseDomain(guest) ?? "food").toLowerCase();

  if (lang === "en") {
    if (section === "drinks") return "drink";
    if (section === "desserts") return "dessert";
    return "food";
  }
  if (section === "drinks") return "piće";
  if (section === "desserts") return "desert";
  return "jelo";
}

export function guestBrowseDomain(
  guest: GuestMemoryProjection
): "food" | "drinks" | "desserts" | null {
  switch (guest.preferredMealPattern) {
    case "drinks_only":
      return "drinks";
    case "main_dessert":
    case "starter_main_dessert":
      return "desserts";
    case "main_only":
    case "main_drinks":
      return "food";
    default:
      return null;
  }
}

function eventMatchesGuestProfile(
  event: EventConfig,
  guest: GuestMemoryProjection
): boolean {
  const presetIds = event.presetProductIds ?? [];
  if (
    presetIds.some((productId) => guest.favoriteProductIds.includes(productId))
  ) {
    return true;
  }

  const domain = guestBrowseDomain(guest);
  const haystack = `${event.name} ${event.specialInstructions}`.toLowerCase();
  if (domain === "drinks" && /bar|cocktail|drink|pivo|vino/.test(haystack)) {
    return true;
  }
  if (domain === "desserts" && /dessert|torta|cake|slatki/.test(haystack)) {
    return true;
  }
  if (domain === "food" && /menu|večer|dinner|food|jelo/.test(haystack)) {
    return true;
  }

  return guest.visitCount >= 2;
}

function isUpcomingEvent(
  event: EventConfig,
  nowMs: number,
  horizonDays = 14
): boolean {
  const start = Date.parse(event.startTime.includes("T") ? event.startTime : "");
  if (Number.isFinite(start)) {
    const horizonMs = horizonDays * 86_400_000;
    return start >= nowMs - 86_400_000 && start <= nowMs + horizonMs;
  }
  return true;
}

/** Resolve which between-visit engagement triggers apply (Q2). */
export function resolveEngagementTriggers(input: {
  guest: GuestMemoryProjection;
  daysSinceLastVisit: number;
  newMenuItems: EngagementMenuProduct[];
  upcomingEvents: EventConfig[];
  nowMs?: number;
  birthdayMonth?: number | null;
  winBackAlreadySent?: boolean;
}): EngagementTrigger[] {
  const triggers: EngagementTrigger[] = [];
  const nowMs = input.nowMs ?? Date.now();
  const month = new Date(nowMs).getUTCMonth() + 1;

  if (
    input.daysSinceLastVisit > WIN_BACK_MIN_DAYS &&
    input.guest.visitCount >= WIN_BACK_MIN_VISITS &&
    !input.winBackAlreadySent
  ) {
    triggers.push("win_back");
  }

  if (
    input.newMenuItems.some((product) =>
      productMatchesGuestInterest(product, input.guest)
    )
  ) {
    triggers.push("weekly_special");
  }

  if (
    LOYALTY_MILESTONES.includes(
      input.guest.visitCount as (typeof LOYALTY_MILESTONES)[number]
    )
  ) {
    triggers.push("loyalty_milestone");
  }

  const birthdayMonth = input.birthdayMonth ?? null;
  if (birthdayMonth != null && birthdayMonth === month) {
    triggers.push("birthday");
  }

  if (input.upcomingEvents.some(
      (event) =>
        isUpcomingEvent(event, nowMs) &&
        eventMatchesGuestProfile(event, input.guest)
    )
  ) {
    triggers.push("event_invite");
  }

  const priority: EngagementTrigger[] = [
    "birthday",
    "loyalty_milestone",
    "win_back",
    "weekly_special",
    "event_invite",
  ];

  return priority.filter((trigger) => triggers.includes(trigger));
}

export function resolveEngagementChannel(input: {
  hasPushSubscription?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  preferredChannel?: "push" | "whatsapp" | "sms" | "email" | null;
}): EngagementChannel {
  if (input.preferredChannel === "push" && input.hasPushSubscription) {
    return "push";
  }
  if (
    (input.preferredChannel === "sms" || input.preferredChannel === "whatsapp") &&
    input.hasPhone
  ) {
    return "sms";
  }
  if (input.hasPushSubscription) return "push";
  if (input.hasPhone) return "sms";
  if (input.hasEmail) return "email";
  return "push";
}

export function monthKeyFromMs(nowMs: number): string {
  const date = new Date(nowMs);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/** Apply GDPR consent + monthly cap + win-back one-shot rules. */
export function filterEngagementTriggersForSend(input: {
  triggers: EngagementTrigger[];
  engagementConsentAt: string | null;
  messagesSentThisMonth: number;
  winBackAlreadySent: boolean;
  nowMs?: number;
}): EngagementTrigger[] {
  if (!input.engagementConsentAt) return [];

  const consentMs = Date.parse(input.engagementConsentAt);
  if (!Number.isFinite(consentMs)) return [];

  let remaining = Math.max(
    0,
    MAX_ENGAGEMENT_MESSAGES_PER_MONTH - input.messagesSentThisMonth
  );
  if (remaining === 0) return [];

  const ordered: EngagementTrigger[] = [
    "birthday",
    "loyalty_milestone",
    "win_back",
    "weekly_special",
    "event_invite",
  ];

  const allowed = new Set(input.triggers);
  const result: EngagementTrigger[] = [];

  for (const trigger of ordered) {
    if (!allowed.has(trigger)) continue;
    if (trigger === "win_back" && input.winBackAlreadySent) continue;
    result.push(trigger);
    remaining -= 1;
    if (remaining === 0) break;
  }

  return result;
}

export function daysSinceLastVisit(
  lastVisitAt: string | null,
  nowMs = Date.now()
): number {
  if (!lastVisitAt) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(lastVisitAt);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((nowMs - parsed) / 86_400_000));
}

export function isChurnRiskGuest(input: {
  visitCount: number;
  daysSinceLastVisit: number;
}): boolean {
  return (
    input.visitCount >= 3 && input.daysSinceLastVisit >= CHURN_RISK_DAYS
  );
}
