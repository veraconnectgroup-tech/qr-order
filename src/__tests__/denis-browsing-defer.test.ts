import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  buildBrowseFollowUpMessage,
  buildVenueWelcomeMessage,
  countBrowsingDeferEvents,
  extractBrowsingDeferredState,
  isGuestBrowsingDeferMessage,
  resolveBrowsingDeferReply,
} from "@/lib/denis/cognition/conversation/browsing-defer";
import { detectProactiveCandidate } from "@/lib/denis/cognition/proactive/detect-proactive-candidate";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function timelineEvent(
  partial: Partial<DenisTimelineRow> & {
    event_type: DenisTimelineRow["event_type"];
  }
): DenisTimelineRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    ai_session_id: partial.ai_session_id ?? "sess-1",
    seq: partial.seq ?? 1,
    event_type: partial.event_type,
    trace_id: partial.trace_id ?? "trace-1",
    context_hash: partial.context_hash ?? null,
    payload: partial.payload ?? { type: partial.event_type },
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

describe("browsing defer detection", () => {
  it("matches common Serbian defer phrases", () => {
    expect(isGuestBrowsingDeferMessage("još gledamo")).toBe(true);
    expect(isGuestBrowsingDeferMessage("Ne još, biramo")).toBe(true);
    expect(isGuestBrowsingDeferMessage("samo gledamo meni")).toBe(true);
  });

  it("rejects ordering or long messages", () => {
    expect(isGuestBrowsingDeferMessage("daj mi dva piva")).toBe(false);
    expect(isGuestBrowsingDeferMessage("a".repeat(200))).toBe(false);
  });

  it("counts defer events from timeline", () => {
    const timeline = [
      timelineEvent({ event_type: "conversation.browsing_deferred" }),
      timelineEvent({ event_type: "tell.committed" }),
      timelineEvent({ event_type: "conversation.browsing_deferred" }),
    ];
    expect(countBrowsingDeferEvents(timeline)).toBe(2);
  });

  it("extracts defer state from guest signal.message", () => {
    const deferredAt = "2026-05-29T10:00:00.000Z";
    const timeline = [
      timelineEvent({
        event_type: "signal.message",
        created_at: deferredAt,
        payload: { type: "signal.message", text: "još gledamo" },
      }),
      timelineEvent({
        event_type: "proactive.emitted",
        payload: { kind: "browse_follow_up" },
      }),
    ];

    expect(extractBrowsingDeferredState(timeline)).toEqual({
      lastDeferredAt: deferredAt,
      deferCount: 1,
      followUpEmitted: true,
    });
  });
});

describe("browsing defer replies", () => {
  it("returns first defer ack then shorter repeat", () => {
    expect(resolveBrowsingDeferReply("sr", 0)).toBe(
      "U redu, javljam se za koji minut."
    );
    expect(resolveBrowsingDeferReply("sr", 1)).toBe(
      "U redu, tu sam kad zatreba."
    );
  });

  it("builds venue-aware welcome and follow-up copy", () => {
    expect(buildVenueWelcomeMessage("Skyline Lounge", "sr")).toContain(
      "Skyline Lounge"
    );
    expect(buildBrowseFollowUpMessage("sr")).toBe(
      "Da li ste već odlučili? Mogu li nekako da pomognem?"
    );
  });
});

const proactiveMessages = {
  browse: "Browse",
  dessert: "Dessert",
  slowKitchen: "Slow",
  guestWelcome: "Welcome",
  browseFollowUp: "Follow up?",
  billPrompt: "Bill",
  orderDelay: "Delay",
  popularityPair: "Pair",
};

describe("browse_follow_up proactive candidate", () => {
  it("fires after defer cooldown when guest has chatted", () => {
    const deferredAt = new Date(Date.now() - 90_000).toISOString();
    const candidate = detectProactiveCandidate({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        guestMessageCount: 1,
        browsingDeferredAt: deferredAt,
        browseFollowUpEmitted: false,
        sessionAgeSeconds: 120,
      },
      messages: proactiveMessages,
      now: Date.now(),
    });

    expect(candidate?.kind).toBe("browse_follow_up");
    expect(candidate?.message).toBe("Follow up?");
  });

  it("skips follow-up before cooldown elapses", () => {
    const deferredAt = new Date(Date.now() - 20_000).toISOString();
    const candidate = detectProactiveCandidate({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        guestMessageCount: 1,
        browsingDeferredAt: deferredAt,
        browseFollowUpEmitted: false,
        sessionAgeSeconds: 120,
      },
      messages: proactiveMessages,
      now: Date.now(),
    });

    expect(candidate).toBeNull();
  });
});
