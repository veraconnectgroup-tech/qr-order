import { describe, expect, it } from "vitest";
import { foldConversationModel } from "@/lib/denis/cognition/conversation/fold-conversation-model";
import {
  extractGuestContinuityState,
  isGuestPauseMessage,
  parseGuestFollowUpRequest,
  resolveFollowUpDueAt,
} from "@/lib/denis/cognition/conversation/guest-continuity";
import { inferAwaitingFromDialogue } from "@/lib/denis/cognition/conversation/infer-awaiting";
import { resolveDenisThinkingContext } from "@/lib/guest/denis-thinking-steps";
import { resolveTurnThinkingStepKeys } from "@/lib/denis/runtime/resolve-turn-thinking-steps";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function row(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>
): DenisTimelineRow {
  return {
    id: `evt-${seq}`,
    ai_session_id: "ai-1",
    seq,
    event_type: eventType,
    payload,
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: `2026-06-07T12:00:0${seq}.000Z`,
  };
}

describe("guest follow-up requests", () => {
  it("parses explicit minute countdown", () => {
    expect(parseGuestFollowUpRequest("dođi za 1 minut ponovo")).toEqual({
      delaySeconds: 60,
    });
    expect(parseGuestFollowUpRequest("come back in 2 minutes")).toEqual({
      delaySeconds: 120,
    });
  });

  it("parses vague comeback phrasing", () => {
    expect(parseGuestFollowUpRequest("dođi za koji minut")).toEqual({
      delaySeconds: 60,
    });
  });

  it("marks pause messages for relational routing", () => {
    expect(isGuestPauseMessage("nisam još")).toBe(true);
    expect(isGuestPauseMessage("dođi za 1 minut ponovo")).toBe(true);
    expect(isGuestPauseMessage("daj mi pivo")).toBe(false);
  });

  it("schedules follow-up from timeline event", () => {
    const timeline = [
      row(1, "conversation.follow_up_requested", {
        type: "conversation.follow_up_requested",
        delaySeconds: 60,
      }),
    ];
    const continuity = extractGuestContinuityState(timeline);
    const dueAt = resolveFollowUpDueAt(continuity, 120);
    expect(dueAt).not.toBeNull();
    expect(continuity.followUpDelaySeconds).toBe(60);
  });
});

describe("conversation model fold", () => {
  it("infers browse_decision awaiting from Denis question", () => {
    const awaiting = inferAwaitingFromDialogue({
      lastDenisText: "Da li ste već odlučili?",
      flowNodeId: "welcome",
      pendingSlot: null,
      commerceConfirm: false,
    });
    expect(awaiting).toBe("browse_decision");
  });

  it("folds transcript and summary for defer thread", () => {
    const model = foldConversationModel({
      timeline: [
        row(1, "tell.committed", {
          type: "tell.committed",
          message: "Da li ste odlučili?",
        }),
        row(2, "signal.message", {
          type: "signal.message",
          text: "dođi za 1 minut",
        }),
      ],
      flowNodeId: "welcome",
      pendingSlot: null,
      commerceConfirm: false,
    });

    expect(model.thread.guestTurns).toBe(1);
    expect(model.awaiting).toBe("browse_decision");
    expect(model.attention.followUpDelaySeconds).toBe(60);
    expect(model.summary).toContain("comeback");
  });
});

describe("thinking steps for guest pause", () => {
  it("uses pause context on client heuristic", () => {
    expect(resolveDenisThinkingContext("dođi za 1 minut ponovo")).toBe(
      "pause"
    );
  });

  it("uses pause steps on server turn plan", () => {
    const keys = resolveTurnThinkingStepKeys({
      kind: "relational_perceive",
      requiresLlm: true,
      suppressUpsell: false,
      reason: "conversation.guest_pause",
    });
    expect(keys[0]).toBe("ai.chat.thinking.pause");
  });
});
