import { describe, expect, it } from "vitest";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import {
  isProactiveDockDuplicate,
  shouldCommitProactiveToDock,
} from "@/lib/denis/loop/proactive-dock-tell";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";

function minimalState(
  timeline: DenisTimelineRow[],
  dismissedNudges: string[] = []
): TableSessionState {
  return {
    table: { id: "t1", name: "1", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: {
        ai: emptyCartState(),
        visibleLines: [],
      },
    },
    venue: {
      ops: {} as TableSessionState["venue"]["ops"],
      opsEffects: {} as TableSessionState["venue"]["opsEffects"],
    },
    conversation: {
      flowNodeId: "welcome",
      foodUpsellAsked: false,
      dismissedNudges,
      lastAssistantMessage: null,
      pendingSlot: null,
    },
    timeline,
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("proactive dock tell (D-PRO)", () => {
  it("commits guest-facing dock tells, not browse or pairing banners", () => {
    expect(shouldCommitProactiveToDock("guest_welcome")).toBe(true);
    expect(shouldCommitProactiveToDock("slow_kitchen")).toBe(true);
    expect(shouldCommitProactiveToDock("order_delay")).toBe(true);
    expect(shouldCommitProactiveToDock("dessert_nudge")).toBe(true);
    expect(shouldCommitProactiveToDock("bill_prompt")).toBe(true);
    expect(shouldCommitProactiveToDock("browse_nudge")).toBe(false);
    expect(shouldCommitProactiveToDock("drink_pairing")).toBe(false);
  });

  it("includes proactive_dock tell in transcript but not sense.proactive banner", () => {
    const message = "Kuhinja radi intenzivno — želite nešto da popijete dok čekate?";
    const transcript = foldTranscriptFromTimeline([
      {
        id: "p1",
        ai_session_id: "ai-1",
        seq: 1,
        event_type: "tell.committed",
        payload: {
          type: "tell.committed",
          message,
          source: "sense.proactive_dock",
        },
        trace_id: "t1",
        context_hash: null,
        created_at: "2026-06-06T12:00:00.000Z",
      },
      {
        id: "p2",
        ai_session_id: "ai-1",
        seq: 2,
        event_type: "tell.committed",
        payload: {
          type: "tell.committed",
          message: "Treba vam pomoć pri biranju?",
          source: "sense.proactive",
        },
        trace_id: "t2",
        context_hash: null,
        created_at: "2026-06-06T12:00:01.000Z",
      },
    ]);

    expect(transcript).toHaveLength(1);
    expect(transcript[0]?.text).toBe(message);
  });

  it("dedupes proactive dock tell when message already in transcript", () => {
    const message = "Spremni za desert?";
    const state = minimalState([
      {
        id: "d1",
        ai_session_id: "ai-1",
        seq: 1,
        event_type: "tell.committed",
        payload: {
          type: "tell.committed",
          message,
          source: "sense.proactive_dock",
        },
        trace_id: "t1",
        context_hash: null,
        created_at: "2026-06-06T12:00:00.000Z",
      },
    ]);

    expect(
      isProactiveDockDuplicate(state, { kind: "dessert_nudge" }, message)
    ).toBe(true);
  });
});
