import { describe, expect, it } from "vitest";
import { resolveTurnThinkingStepKeys } from "@/lib/denis/runtime/resolve-turn-thinking-steps";

describe("resolveTurnThinkingStepKeys", () => {
  it("maps status plan to status step", () => {
    expect(
      resolveTurnThinkingStepKeys({
        kind: "template_tell",
        requiresLlm: false,
        suppressUpsell: false,
        reason: "commerce.status.open_order",
      })
    ).toEqual(["ai.chat.thinking.status"]);
  });

  it("caps vague recommend to two steps", () => {
    expect(
      resolveTurnThinkingStepKeys({
        kind: "relational_perceive",
        requiresLlm: true,
        suppressUpsell: false,
        reason: "vague_recommend",
      })
    ).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.recommend",
    ]);
  });

  it("maps waiter handoff before plan kind", () => {
    expect(
      resolveTurnThinkingStepKeys(
        {
          kind: "reflex_only",
          requiresLlm: false,
          suppressUpsell: false,
          reason: "t0_reflex_or_handoff",
        },
        { handoffCommand: { type: "WAITER.REQUEST" } }
      )
    ).toEqual(["ai.chat.thinking.waiter"]);
  });

  it("caps confirm comprehend to two cart steps", () => {
    expect(
      resolveTurnThinkingStepKeys({
        kind: "transactional_perceive",
        requiresLlm: true,
        suppressUpsell: false,
        reason: "commerce.awaiting_confirm.comprehend",
      })
    ).toEqual([
      "ai.chat.thinking.cart",
      "ai.chat.thinking.confirm",
    ]);
  });

  it("maps guest pause to a single pause step", () => {
    expect(
      resolveTurnThinkingStepKeys({
        kind: "relational_perceive",
        requiresLlm: true,
        suppressUpsell: false,
        reason: "conversation.guest_pause",
      })
    ).toEqual(["ai.chat.thinking.pause"]);
  });
});
