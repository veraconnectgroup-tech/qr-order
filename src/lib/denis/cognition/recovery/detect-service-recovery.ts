/**
 * ADR-043 S12 — service recovery triggers (deterministic, no new ML infra).
 */
import { isGuestOrderComplaintMessage } from "@/lib/denis/cognition/tde/semantic-intent-router";
import type { GuestAffect } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { ConciergeServiceRecovery } from "@/lib/denis/config/concierge-config.schema";
import type { OrderLifecycleBeliefs } from "@/lib/denis/cognition/recovery/frustration-recovery";

export type ServiceRecoveryTrigger =
  | "guest_complaint"
  | "high_frustration"
  | "negative_sentiment"
  | "long_wait_silence";

/** Extended complaint lexicon beyond semantic-intent-router REGEX_COMPLAINT. */
const EXTENDED_COMPLAINT_PATTERN =
  /\b(loše|lose|užasno|uzasno|nezadovolj\w*|hladn\w*|dosadno|presporo|predugo|predug|čekam\s+predugo|cekam\s+predugo|disappoint\w*|terrible|awful|schlecht|kalt|zu\s+lange|not\s+happy|unhappy|complaint|reklamacij\w*|žalb\w*|zalb\w*|nije\s+u\s+redu|nije\s+ok|disgusting|odvratno)\b/i;

export function isGuestServiceComplaintMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isGuestOrderComplaintMessage(text)) return true;
  return EXTENDED_COMPLAINT_PATTERN.test(text);
}

export function detectLongWaitSilence(input: {
  waiting: boolean;
  lastGuestMessageAtMs: number | null;
  nowMs: number;
  silenceMinutes: number;
}): boolean {
  if (!input.waiting) return false;
  if (input.lastGuestMessageAtMs == null) return false;
  const idleMinutes = (input.nowMs - input.lastGuestMessageAtMs) / 60_000;
  return idleMinutes >= input.silenceMinutes;
}

export type ServiceRecoveryTriggerResult = {
  shouldEscalate: boolean;
  triggers: ServiceRecoveryTrigger[];
  complaintSnippet: string | null;
  waitMinutes: number | null;
};

export function detectServiceRecoveryTrigger(input: {
  guestMessage: string;
  affect: GuestAffect | null;
  orderLifecycle: OrderLifecycleBeliefs | null;
  config: ConciergeServiceRecovery;
  lastGuestMessageAtMs?: number | null;
  nowMs?: number;
  oldestOpenOrderAgeMinutes?: number | null;
}): ServiceRecoveryTriggerResult {
  if (!input.config.enabled) {
    return {
      shouldEscalate: false,
      triggers: [],
      complaintSnippet: null,
      waitMinutes: null,
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  const triggers: ServiceRecoveryTrigger[] = [];
  const waiting = input.orderLifecycle?.isWaiting ?? false;
  const frustrationLevel = input.affect?.frustration.level ?? "none";
  const sentiment = input.affect?.sentiment.score ?? 0;

  const complaint = isGuestServiceComplaintMessage(input.guestMessage);
  if (complaint) {
    triggers.push("guest_complaint");
  }

  if (frustrationLevel === "high") {
    triggers.push("high_frustration");
  }

  if (sentiment < -0.5) {
    triggers.push("negative_sentiment");
  }

  if (
    detectLongWaitSilence({
      waiting,
      lastGuestMessageAtMs: input.lastGuestMessageAtMs ?? null,
      nowMs,
      silenceMinutes: input.config.waitSilenceMinutes,
    })
  ) {
    triggers.push("long_wait_silence");
  }

  const shouldEscalate =
    triggers.includes("guest_complaint") ||
    triggers.includes("high_frustration") ||
    triggers.includes("negative_sentiment") ||
    (triggers.includes("long_wait_silence") &&
      (frustrationLevel === "mild" || frustrationLevel === "high"));

  const snippet = complaint
    ? input.guestMessage.trim().slice(0, 120)
    : null;

  const waitMinutes =
    input.oldestOpenOrderAgeMinutes != null &&
    Number.isFinite(input.oldestOpenOrderAgeMinutes)
      ? Math.max(0, Math.round(input.oldestOpenOrderAgeMinutes))
      : waiting && input.lastGuestMessageAtMs != null
        ? Math.max(0, Math.round((nowMs - input.lastGuestMessageAtMs) / 60_000))
        : null;

  return {
    shouldEscalate,
    triggers,
    complaintSnippet: snippet,
    waitMinutes,
  };
}
