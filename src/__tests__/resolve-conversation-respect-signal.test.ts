import { describe, expect, it } from "vitest";
import { resolveConversationRespectSignal } from "@/lib/denis/cognition/personality/resolve-conversation-respect-signal";

describe("resolveConversationRespectSignal", () => {
  it("is 0 on a clean, first-ask, still-open conversation", () => {
    expect(
      resolveConversationRespectSignal({
        dismissiveTranscriptSeen: false,
        turnsConsumed: 0,
        wasAbandoned: false,
      })
    ).toBe(0);
  });

  it("rises as retries are consumed re-asking the same thing", () => {
    const early = resolveConversationRespectSignal({
      dismissiveTranscriptSeen: false,
      turnsConsumed: 1,
      wasAbandoned: false,
    });
    const late = resolveConversationRespectSignal({
      dismissiveTranscriptSeen: false,
      turnsConsumed: 4,
      wasAbandoned: false,
    });
    expect(late).toBeGreaterThan(early);
    expect(late).toBe(1);
  });

  it("maxes out immediately on a single dismissive reply, even on the first turn", () => {
    expect(
      resolveConversationRespectSignal({
        dismissiveTranscriptSeen: true,
        turnsConsumed: 0,
        wasAbandoned: false,
      })
    ).toBe(1);
  });

  it("registers a real but softer pressure when the conversation was abandoned", () => {
    const ratio = resolveConversationRespectSignal({
      dismissiveTranscriptSeen: false,
      turnsConsumed: 0,
      wasAbandoned: true,
    });
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  it("takes whichever signal is worse, not an average", () => {
    const ratio = resolveConversationRespectSignal({
      dismissiveTranscriptSeen: true,
      turnsConsumed: 0,
      wasAbandoned: false,
    });
    expect(ratio).toBe(1);
  });

  it("clamps turnsConsumed beyond the cap", () => {
    const ratio = resolveConversationRespectSignal({
      dismissiveTranscriptSeen: false,
      turnsConsumed: 999,
      wasAbandoned: false,
    });
    expect(ratio).toBe(1);
  });
});
