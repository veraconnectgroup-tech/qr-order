import { templateUtteranceForKey } from "@/lib/denis/cognition/tde/template-utterance";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const BROWSING_DEFER_PATTERN =
  /\b(ne\s+j[oš]s?|nije\s+j[oš]s?|jo[sš]\s+(uvek\s+)?(gledamo|razgledavamo|pregledavamo|biramo|odlučujemo)|samo\s+(gledamo|razgledavamo|biramo)|not\s+yet|still\s+(looking|browsing|deciding)|noch\s+nicht|nur\s+am\s+(schauen|überlegen)|haben\s+noch\s+nicht)\b/i;

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function guestTextFromTimeline(event: DenisTimelineRow): string | null {
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

export function countBrowsingDeferEvents(timeline: DenisTimelineRow[]): number {
  let count = 0;
  for (const event of timeline) {
    if (event.event_type === "conversation.browsing_deferred") {
      count += 1;
      continue;
    }
    if (event.event_type === "signal.message") {
      const guestText = guestTextFromTimeline(event);
      if (guestText && isGuestBrowsingDeferMessage(guestText)) {
        count += 1;
      }
    }
  }
  return count;
}

export type BrowsingDeferredState = {
  lastDeferredAt: string | null;
  deferCount: number;
  followUpEmitted: boolean;
};

export function extractBrowsingDeferredState(
  timeline: DenisTimelineRow[]
): BrowsingDeferredState {
  let lastDeferredAt: string | null = null;
  let deferCount = 0;
  let followUpEmitted = false;

  for (const event of timeline) {
    if (event.event_type === "conversation.browsing_deferred") {
      deferCount += 1;
      lastDeferredAt = event.created_at;
      continue;
    }

    if (event.event_type === "signal.message") {
      const guestText = guestTextFromTimeline(event);
      if (guestText && isGuestBrowsingDeferMessage(guestText)) {
        deferCount += 1;
        lastDeferredAt = event.created_at;
        continue;
      }
    }

    if (event.event_type !== "proactive.emitted") continue;
    const payload = asRecord(event.payload);
    if (payload.kind === "browse_follow_up") {
      followUpEmitted = true;
    }
  }

  return { lastDeferredAt, deferCount, followUpEmitted };
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
