import { describe, expect, it } from "vitest";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  buildLoopRecoveryContent,
  detectConversationLoop,
  messagesAreSimilar,
  resolveLoopRecoveryAfterAttempts,
  shouldSkipLlmForLoop,
  textSimilarity,
} from "@/lib/denis/monitoring";

function tellRow(seq: number, message: string): DenisTimelineRow {
  return {
    id: `tell-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "tell.committed",
    payload: { type: "tell.committed", message, tier: "template" },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() + seq * 1000).toISOString(),
  };
}

function guestRow(seq: number, text: string): DenisTimelineRow {
  return {
    id: `guest-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      frame: {
        channel: "chat.message",
        normalizedText: text,
        structuredIntent: null,
        ingestedAt: new Date().toISOString(),
      },
      envelope: { traceId: "t1", surface: "chat" },
    },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() + seq * 1000).toISOString(),
  };
}

describe("loop detection (S2)", () => {
  it("textSimilarity treats punctuation-normalized lines as equal", () => {
    expect(textSimilarity("Šta želite naručiti?", "Sta zelite naruciti")).toBe(1);
    expect(messagesAreSimilar("Hello!", "hello")).toBe(true);
  });

  it("3× repeat_response → stuck + offer_chips", () => {
    const timeline = [
      tellRow(1, "Šta želite naručiti?"),
      guestRow(2, "Ne znam"),
      tellRow(3, "Šta želite naručiti?"),
      guestRow(4, "Hmm"),
      tellRow(5, "Šta želite naručiti?"),
    ];

    const result = detectConversationLoop(timeline, 6);

    expect(result.detected).toBe(true);
    expect(result.type).toBe("repeat_response");
    expect(result.severity).toBe("stuck");
    expect(result.recovery.action).toBe("offer_chips");
    expect(shouldSkipLlmForLoop(result, 0)).toBe(true);

    const content = buildLoopRecoveryContent({
      recovery: result.recovery,
      language: "sr",
    });
    expect(content.message).toContain("ne ponavljam");
    expect(content.quickReplies.length).toBeGreaterThan(0);
  });

  it("2× similar Denis replies → mild repeat_response", () => {
    const timeline = [
      tellRow(1, "Šta želite naručiti?"),
      guestRow(2, "Piće"),
      tellRow(3, "Šta želite naručiti?"),
    ];

    const result = detectConversationLoop(timeline, 6);

    expect(result.detected).toBe(true);
    expect(result.type).toBe("repeat_response");
    expect(result.severity).toBe("mild");
    expect(shouldSkipLlmForLoop(result, 0)).toBe(false);
  });

  it("info_re_ask when Denis repeats question after guest answered", () => {
    const timeline = [
      tellRow(1, "Imate li alergije?"),
      guestRow(2, "Da, na orašaste"),
      tellRow(3, "Razumem, hvala."),
      guestRow(4, "Ok"),
      tellRow(5, "Da li ste alergični na nešto?"),
    ];

    const result = detectConversationLoop(timeline, 8);

    expect(result.detected).toBe(true);
    expect(result.type).toBe("info_re_ask");
    expect(result.severity).toBe("stuck");
    if (result.recovery.action === "rephrase") {
      expect(result.recovery.guestAnswer).toContain("orašaste");
    }
  });

  it("max recovery attempts → escalate_staff", () => {
    const detection = detectConversationLoop(
      [tellRow(1, "A"), tellRow(2, "A"), tellRow(3, "A")],
      6
    );

    expect(shouldSkipLlmForLoop(detection, 2)).toBe(true);
    const recovery = resolveLoopRecoveryAfterAttempts(detection, 2);
    expect(recovery.action).toBe("escalate_staff");

    const content = buildLoopRecoveryContent({
      recovery,
      language: "sr",
    });
    expect(content.message).not.toMatch(/imam problem/i);
    expect(content.message).toMatch(/krug|ponavljam/i);
  });

  it("flip_flop A→B→A pattern", () => {
    const timeline = [
      tellRow(1, "Hoćete piće?"),
      tellRow(2, "Pogledajte meni za hranu."),
      tellRow(3, "Hoćete piće?"),
    ];

    const result = detectConversationLoop(timeline, 6);

    expect(result.detected).toBe(true);
    expect(result.type).toBe("flip_flop");
    expect(result.recovery.action).toBe("reset_context");
  });
});
