import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { OfferTiming } from "@/lib/denis/cognition/offer/offer-types";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const HAPPY_PATTERN =
  /\b(odli[cč]no|super|bas dobro|savr[sš]eno|excellent|great|love it|perfekt)\b/i;

const DECLINE_PATTERN =
  /\b(ne\s+hvala|ne\s+mora|no\s+thanks|not\s+interested)\b/i;

const CHAT_LULL_MIN_MESSAGES = 3;
const CHAT_LULL_WINDOW_MS = 10 * 60 * 1000;
const CHAT_LULL_SILENCE_MS = 3 * 60 * 1000;
const RECENT_GUEST_ACTIVE_MS = 30 * 1000;
const RECENT_DECLINE_MS = 60 * 1000;

export type SessionTrajectory = {
  ordering: "accelerating" | "steady" | "stuck" | "completing";
  engagement: "hot" | "warm" | "lull" | "cold";
  meal: "pre" | "active" | "post" | "paying";
  interruptionRisk: number;
  opportunity: number;
  evidence: string[];
};

function chatLullEvidence(timeline: DenisTimelineRow[], nowMs: number): string | null {
  const windowStart = nowMs - CHAT_LULL_WINDOW_MS;
  let guestMsgCount = 0;
  let lastGuestMsgMs = 0;

  for (const row of timeline) {
    const atMs = new Date(row.created_at).getTime();
    if (atMs < windowStart) continue;
    const text = guestTextFromTimeline(row);
    if (!text?.trim()) continue;
    guestMsgCount += 1;
    lastGuestMsgMs = Math.max(lastGuestMsgMs, atMs);
  }

  if (guestMsgCount < CHAT_LULL_MIN_MESSAGES || lastGuestMsgMs === 0) {
    return null;
  }

  const silentForMs = nowMs - lastGuestMsgMs;
  if (silentForMs < CHAT_LULL_SILENCE_MS) return null;

  return `chat.lull:${guestMsgCount}msgs,silent_${Math.round(silentForMs / 1000)}s`;
}

function recentGuestActivityMs(
  timeline: DenisTimelineRow[],
  nowMs: number
): number | null {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const row = timeline[i]!;
    const text = guestTextFromTimeline(row);
    if (!text?.trim()) continue;
    return nowMs - new Date(row.created_at).getTime();
  }
  return null;
}

function recentDeclineMs(timeline: DenisTimelineRow[], nowMs: number): number | null {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const row = timeline[i]!;
    const text = guestTextFromTimeline(row);
    if (!text || !DECLINE_PATTERN.test(text)) continue;
    return nowMs - new Date(row.created_at).getTime();
  }
  return null;
}

function happySignalEvidence(timeline: DenisTimelineRow[], nowMs: number): string | null {
  const windowStart = nowMs - 5 * 60 * 1000;
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const row = timeline[i]!;
    const atMs = new Date(row.created_at).getTime();
    if (atMs < windowStart) break;
    const text = guestTextFromTimeline(row);
    if (text && HAPPY_PATTERN.test(text)) {
      return "chat.happy_sentiment";
    }
  }
  return null;
}

function allDeliveredIdle(orders: OrderFact[], nowMs: number, idleSec: number): boolean {
  if (orders.length === 0) return false;
  if (!orders.every((order) => order.status === "delivered")) return false;
  const latest = orders
    .map((order) => new Date(order.createdAt).getTime())
    .sort((a, b) => b - a)[0];
  if (latest == null) return false;
  return (nowMs - latest) / 1000 >= idleSec;
}

function deriveOrdering(input: {
  timing: OfferTiming | null | undefined;
  mental: GuestMentalModel;
  cartLineCount: number;
  browse: GuestBrowseProfile;
}): SessionTrajectory["ordering"] {
  if (
    input.mental.mealStage === "post_meal" ||
    input.mental.mealStage === "paying" ||
    input.mental.predictedNeed === "wants_bill"
  ) {
    return "completing";
  }

  if (input.cartLineCount > 0) {
    return "accelerating";
  }

  if (
    input.timing?.ready &&
    (input.timing.kind === "browse_pause" ||
      input.timing.kind === "cart_hesitation" ||
      input.timing.kind === "return_view")
  ) {
    return "stuck";
  }

  if (input.browse.viewedProducts.length >= 3) {
    return "steady";
  }

  return "steady";
}

function deriveEngagement(input: {
  lullEvidence: string | null;
  recentGuestMs: number | null;
  happyEvidence: string | null;
}): SessionTrajectory["engagement"] {
  if (input.happyEvidence) return "hot";
  if (input.recentGuestMs != null && input.recentGuestMs <= RECENT_GUEST_ACTIVE_MS) {
    return "hot";
  }
  if (input.lullEvidence) return "lull";
  if (input.recentGuestMs != null && input.recentGuestMs <= 2 * 60 * 1000) {
    return "warm";
  }
  return "cold";
}

function deriveMeal(mental: GuestMentalModel): SessionTrajectory["meal"] {
  switch (mental.mealStage) {
    case "pre_order":
    case "aperitif":
      return "pre";
    case "main":
    case "between_courses":
    case "dessert_window":
      return "active";
    case "post_meal":
      return "post";
    case "paying":
      return "paying";
    default:
      return "pre";
  }
}

/** ADR-041 — session momentum fold (Kad²). Pure; 0 DB; 0 LLM. */
export function foldSessionTrajectory(input: {
  timeline: DenisTimelineRow[];
  browse: GuestBrowseProfile;
  mental: GuestMentalModel;
  orders: OrderFact[];
  cartLineCount: number;
  timing: OfferTiming | null | undefined;
  nowMs?: number;
}): SessionTrajectory {
  const nowMs = input.nowMs ?? Date.now();
  const evidence: string[] = [];

  const lullEvidence = chatLullEvidence(input.timeline, nowMs);
  if (lullEvidence) evidence.push(lullEvidence);

  const happyEvidence = happySignalEvidence(input.timeline, nowMs);
  if (happyEvidence) evidence.push(happyEvidence);

  const recentGuestMs = recentGuestActivityMs(input.timeline, nowMs);
  if (recentGuestMs != null && recentGuestMs <= RECENT_GUEST_ACTIVE_MS) {
    evidence.push(`chat.active_${Math.round(recentGuestMs / 1000)}s`);
  }

  const declineMs = recentDeclineMs(input.timeline, nowMs);
  if (declineMs != null && declineMs <= RECENT_DECLINE_MS) {
    evidence.push(`decline.recent_${Math.round(declineMs / 1000)}s`);
  }

  if (input.timing?.kind === "browse_pause" && input.timing.ready) {
    evidence.push(`browse.idle_${Math.round(input.timing.idleSinceBrowseSec)}s`);
  }

  if (input.timing?.kind === "return_view" && input.timing.ready) {
    evidence.push("browse.return_view");
  }

  if (input.timing?.kind === "cart_hesitation" && input.timing.ready) {
    evidence.push("browse.cart_resumed");
  }

  if (allDeliveredIdle(input.orders, nowMs, 5 * 60)) {
    evidence.push("commerce.all_delivered_idle");
  }

  const ordering = deriveOrdering({
    timing: input.timing,
    mental: input.mental,
    cartLineCount: input.cartLineCount,
    browse: input.browse,
  });

  const engagement = deriveEngagement({
    lullEvidence,
    recentGuestMs,
    happyEvidence,
  });

  const meal = deriveMeal(input.mental);

  let interruptionRisk = 0;
  if (declineMs != null && declineMs <= RECENT_DECLINE_MS) interruptionRisk += 0.6;
  if (recentGuestMs != null && recentGuestMs <= RECENT_GUEST_ACTIVE_MS) {
    interruptionRisk += 0.5;
  }
  if (input.mental.decline.hardClosed || input.mental.receptiveness === "closed") {
    interruptionRisk += 0.4;
  }
  interruptionRisk = Math.min(1, interruptionRisk);

  let opportunity = 0.2;
  if (ordering === "stuck") opportunity += 0.35;
  if (engagement === "lull") opportunity += 0.25;
  if (happyEvidence) opportunity += 0.3;
  if (meal === "post") opportunity += 0.2;
  if (input.mental.predictedNeed === "needs_help_choosing") opportunity += 0.15;
  if (lullEvidence && happyEvidence) opportunity += 0.15;
  opportunity = Math.min(1, opportunity * (1 - interruptionRisk * 0.5));

  return {
    ordering,
    engagement,
    meal,
    interruptionRisk,
    opportunity,
    evidence,
  };
}
