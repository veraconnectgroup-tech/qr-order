import { resolveGuestMessageLanguage } from "@/lib/ai/config";
import { templateUtteranceForKey } from "@/lib/denis/cognition/tde/template-utterance";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const BROWSING_DEFER_PATTERN =
  /\b(ne\s+j[oš]s?|nije\s+j[oš]s?|nisam\s+j[oš]s?|jo[sš]\s+(uvek\s+)?(gledamo|razgledavamo|pregledavamo|biramo|odlučujemo)|samo\s+(gledamo|razgledavamo|biramo)|not\s+yet|still\s+(looking|browsing|deciding)|noch\s+nicht|nur\s+am\s+(schauen|überlegen)|haben\s+noch\s+nicht)\b/i;

const GUEST_FOLLOW_UP_VERB_PATTERN =
  /(?:dođi|dodji|do\s*đi|dodj(?:e|es|i)?|vrati\s+se|javi(?:\s+se)?|come\s+back|check\s+back|komm\s+zurück)/i;

const GUEST_FOLLOW_UP_MINUTE_THEN_VERB_PATTERN =
  /(?:mo[žz]eš|mozes|can\s+you).{0,40}?\bza\s+(?:(\d{1,2})\s*)?minut.{0,40}?(?:dodj|dođi|dodji|ponovo|again)/i;

const GUEST_FOLLOW_UP_DIGIT_PATTERN =
  new RegExp(
    `${GUEST_FOLLOW_UP_VERB_PATTERN.source}.{0,40}?(\\d{1,2})\\s*(?:minut|minute|min\\b)|(\\d{1,2})\\s*(?:minut|minute|min\\b).{0,30}?(?:ponovo|ponova|again|nochmal)`,
    "i"
  );

const GUEST_FOLLOW_UP_VAGUE_PATTERN =
  new RegExp(
    `${GUEST_FOLLOW_UP_VERB_PATTERN.source}.{0,30}?(?:za\\s+)?(?:koj[ií]|par|nekoliko|few|ein\\s+paar)\\s*minut`,
    "i"
  );

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

export function isGuestBrowsingDeferMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 160) return false;
  return BROWSING_DEFER_PATTERN.test(text);
}

/** Guest asked Denis to return after N minutes (or vague "in a minute"). */
export function parseGuestFollowUpRequest(
  message: string
): { delaySeconds: number } | null {
  const text = message.trim();
  if (!text || text.length > 160) return null;

  const digitMatch = text.match(GUEST_FOLLOW_UP_DIGIT_PATTERN);
  if (digitMatch) {
    const minutes = Number(digitMatch[1] ?? digitMatch[2]);
    if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 30) {
      return { delaySeconds: minutes * 60 };
    }
  }

  if (GUEST_FOLLOW_UP_VAGUE_PATTERN.test(text)) {
    return { delaySeconds: DEFAULT_FOLLOW_UP_SECONDS };
  }

  const minuteThenVerb = text.match(GUEST_FOLLOW_UP_MINUTE_THEN_VERB_PATTERN);
  if (minuteThenVerb) {
    const minutes = minuteThenVerb[1] ? Number(minuteThenVerb[1]) : 1;
    if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 30) {
      return { delaySeconds: minutes * 60 };
    }
    return { delaySeconds: DEFAULT_FOLLOW_UP_SECONDS };
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

const MISUNDERSTANDING_DECLINE_PATTERN =
  /^(ne|n[e]+|no|nein|nope|to nije|nije to|not that|falsch|wrong)([\s,.!]|$)/i;

/** Bare "ne" / correction — Denis misunderstood, not polite decline of whole order. */
export function isGuestMisunderstandingDecline(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 80) return false;
  if (/\b(hvala|danke|thanks|treba|potrebno)\b/i.test(text)) return false;
  return MISUNDERSTANDING_DECLINE_PATTERN.test(text);
}

export type GuestContinuityState = {
  lastDeferredAt: string | null;
  deferCount: number;
  followUpEmitted: boolean;
  followUpRequestedAt: string | null;
  followUpDelaySeconds: number | null;
};

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

    if (event.event_type === "signal.message") {
      const guestText = guestTextFromTimeline(event);
      if (!guestText) continue;

      if (isGuestBrowsingDeferMessage(guestText)) {
        deferCount += 1;
        lastDeferredAt = event.created_at;
        continue;
      }

      const followUp = parseGuestFollowUpRequest(guestText);
      if (followUp) {
        deferCount += 1;
        lastDeferredAt = event.created_at;
        followUpRequestedAt = event.created_at;
        followUpDelaySeconds = followUp.delaySeconds;
      }
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
