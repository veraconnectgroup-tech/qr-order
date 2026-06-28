import { resolveGuestMessageLanguage } from "@/lib/ai/config";
import {
  extractTurnInterpretation,
  readGuestInterpretationFromTimelineRow,
} from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import { isGuestStillBrowsingMessage } from "@/lib/denis/cognition/tde/semantic-intent-router";
import { templateUtteranceForKey } from "@/lib/denis/cognition/tde/template-utterance";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const DEFAULT_FOLLOW_UP_SECONDS = 60;

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function guestTextFromTimeline(event: DenisTimelineRow): string | null {
  if (event.event_type === "signal.message") {
    const text =
      typeof asRecord(event.payload).text === "string"
        ? (asRecord(event.payload).text as string).trim()
        : "";
    return text || null;
  }

  if (event.event_type === "perception.ingested") {
    const frame = asRecord(event.payload).frame;
    if (!frame || typeof frame !== "object") return null;
    if ((frame as Record<string, unknown>).channel === "telemetry.browse") {
      return null;
    }
    const text =
      typeof (frame as Record<string, unknown>).normalizedText === "string"
        ? ((frame as Record<string, unknown>).normalizedText as string).trim()
        : "";
    return text || null;
  }

  return null;
}

function interpretationForGuestText(
  guestText: string,
  rowInterpretation?: TurnInterpretation | null
): TurnInterpretation {
  if (rowInterpretation) return rowInterpretation;
  return extractTurnInterpretation({ guestMessage: guestText, llmUsed: false });
}

export function isGuestBrowsingDeferMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 160) return false;
  return isGuestStillBrowsingMessage(text);
}

/** Guest asked Denis to return after N minutes (or vague "in a minute"). */
export function parseGuestFollowUpRequest(
  message: string,
  interpretation?: TurnInterpretation | null
): { delaySeconds: number } | null {
  const text = message.trim();
  if (!text || text.length > 160) return null;

  const interp =
    interpretation ?? extractTurnInterpretation({ guestMessage: text, llmUsed: false });
  if (interp.followUpMinutes != null && interp.followUpMinutes >= 1) {
    return { delaySeconds: Math.min(interp.followUpMinutes, 30) * 60 };
  }

  return null;
}

/** Pause / defer / explicit comeback request — relational thread, not menu browse. */
export function isGuestPauseMessage(message: string): boolean {
  return (
    isGuestBrowsingDeferMessage(message) ||
    parseGuestFollowUpRequest(message) !== null
  );
}

/** Bare "ne" / correction — Denis misunderstood, not polite decline of whole order. */
export function isGuestMisunderstandingDecline(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 80) return false;
  if (/\b(hvala|danke|thanks|treba|potrebno)\b/i.test(text)) return false;
  return /^(ne|n[e]+|no|nein|nope|to nije|nije to|not that|falsch|wrong)([\s,.!]|$)/i.test(
    text
  );
}

export type GuestContinuityState = {
  lastDeferredAt: string | null;
  deferCount: number;
  followUpEmitted: boolean;
  followUpRequestedAt: string | null;
  followUpDelaySeconds: number | null;
};

function applyGuestContinuityFromText(
  guestText: string,
  createdAt: string,
  interpretation: TurnInterpretation | null | undefined,
  state: GuestContinuityState
): GuestContinuityState {
  const interp = interpretationForGuestText(guestText, interpretation);
  let next = { ...state };

  if (isGuestBrowsingDeferMessage(guestText)) {
    next.deferCount += 1;
    next.lastDeferredAt = createdAt;
    return next;
  }

  const followUp = parseGuestFollowUpRequest(guestText, interp);
  if (followUp) {
    next.deferCount += 1;
    next.lastDeferredAt = createdAt;
    next.followUpRequestedAt = createdAt;
    next.followUpDelaySeconds = followUp.delaySeconds;
  }

  return next;
}

export function extractGuestContinuityState(
  timeline: DenisTimelineRow[]
): GuestContinuityState {
  let lastDeferredAt: string | null = null;
  let deferCount = 0;
  let followUpEmitted = false;
  let followUpRequestedAt: string | null = null;
  let followUpDelaySeconds: number | null = null;

  for (const event of timeline) {
    if (event.event_type === "conversation.browsing_deferred") {
      deferCount += 1;
      lastDeferredAt = event.created_at;
      continue;
    }

    if (event.event_type === "conversation.follow_up_requested") {
      const payload = asRecord(event.payload);
      const seconds =
        typeof payload.delaySeconds === "number"
          ? payload.delaySeconds
          : DEFAULT_FOLLOW_UP_SECONDS;
      followUpRequestedAt = event.created_at;
      followUpDelaySeconds = seconds;
      lastDeferredAt = event.created_at;
      deferCount += 1;
      continue;
    }

    if (event.event_type === "perception.ingested") {
      const guestText = guestTextFromTimeline(event);
      if (!guestText) continue;

      const interpretation = readGuestInterpretationFromTimelineRow(event);
      const next = applyGuestContinuityFromText(
        guestText,
        event.created_at,
        interpretation,
        {
          lastDeferredAt,
          deferCount,
          followUpEmitted,
          followUpRequestedAt,
          followUpDelaySeconds,
        }
      );
      lastDeferredAt = next.lastDeferredAt;
      deferCount = next.deferCount;
      followUpRequestedAt = next.followUpRequestedAt;
      followUpDelaySeconds = next.followUpDelaySeconds;
      continue;
    }

    if (event.event_type === "signal.message") {
      const guestText = guestTextFromTimeline(event);
      if (!guestText) continue;

      const next = applyGuestContinuityFromText(
        guestText,
        event.created_at,
        null,
        {
          lastDeferredAt,
          deferCount,
          followUpEmitted,
          followUpRequestedAt,
          followUpDelaySeconds,
        }
      );
      lastDeferredAt = next.lastDeferredAt;
      deferCount = next.deferCount;
      followUpRequestedAt = next.followUpRequestedAt;
      followUpDelaySeconds = next.followUpDelaySeconds;
      continue;
    }

    if (event.event_type !== "proactive.emitted") continue;
    const payload = asRecord(event.payload);
    if (payload.kind === "browse_follow_up") {
      followUpEmitted = true;
    }
  }

  return {
    lastDeferredAt,
    deferCount,
    followUpEmitted,
    followUpRequestedAt,
    followUpDelaySeconds,
  };
}

/** When cron should emit browse_follow_up (ms since epoch). */
export function resolveFollowUpDueAt(
  continuity: GuestContinuityState,
  fallbackSeconds: number
): number | null {
  if (!continuity.lastDeferredAt || continuity.followUpEmitted) {
    return null;
  }

  const base = new Date(continuity.lastDeferredAt).getTime();
  const delaySeconds =
    continuity.followUpDelaySeconds ?? fallbackSeconds;
  return base + delaySeconds * 1000;
}

export function detectGuestLanguageFromTimeline(
  timeline: DenisTimelineRow[],
  venueDefault: string
): string {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const text = guestTextFromTimeline(timeline[i]!);
    if (!text) continue;
    return resolveGuestMessageLanguage(text, venueDefault);
  }
  return venueDefault;
}

export function countBrowsingDeferEvents(timeline: DenisTimelineRow[]): number {
  return extractGuestContinuityState(timeline).deferCount;
}

export function extractBrowsingDeferredState(
  timeline: DenisTimelineRow[]
): Pick<
  GuestContinuityState,
  "lastDeferredAt" | "deferCount" | "followUpEmitted"
> {
  const state = extractGuestContinuityState(timeline);
  return {
    lastDeferredAt: state.lastDeferredAt,
    deferCount: state.deferCount,
    followUpEmitted: state.followUpEmitted,
  };
}

export function resolveBrowsingDeferReply(
  language: string,
  priorDeferCount: number
): string | null {
  const key =
    priorDeferCount > 0 ? "browse.defer_ack_repeat" : "browse.defer_ack";
  return (
    templateUtteranceForKey(key, language) ??
    (priorDeferCount > 0
      ? "U redu, tu sam kad zatreba."
      : "U redu, javljam se za koji minut.")
  );
}

export function buildVenueWelcomeMessage(
  venueName: string,
  language: string
): string {
  const name = venueName.trim() || "restoran";
  const template =
    templateUtteranceForKey("proactive.guest_welcome", language) ??
    "Dobar dan i dobrodošli u {venueName}! Da li ste već odlučili?";
  return template.replaceAll("{venueName}", name);
}

export function buildBrowseFollowUpMessage(language: string): string {
  return (
    templateUtteranceForKey("proactive.browse_follow_up", language) ??
    "Da li ste već odlučili? Mogu li da pomognem?"
  );
}
