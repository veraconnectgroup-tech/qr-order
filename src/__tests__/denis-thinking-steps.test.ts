import { describe, expect, it } from "vitest";
import {
  capDenisThinkingStepKeys,
  DENIS_THINKING_STEP_MS,
  MAX_DENIS_THINKING_STEPS,
  resolveDenisThinkingContext,
  resolveDenisThinkingStepKeys,
} from "@/lib/guest/denis-thinking-steps";
import {
  isGuestPauseMessage,
  isMenuBrowseMessage,
} from "@/lib/guest/denis-guest-recovery";

describe("denis-thinking-steps", () => {
  it("maps menu browse phrases to menu context", () => {
    expect(resolveDenisThinkingContext("sta imate")).toBe("menu");
    expect(resolveDenisThinkingContext("Šta imate na meniju?")).toBe("menu");
    expect(isMenuBrowseMessage("preporuči mi pivo")).toBe(true);
    expect(resolveDenisThinkingStepKeys("preporuči mi pivo")).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.recommend",
    ]);
  });

  it("maps payment intent", () => {
    expect(resolveDenisThinkingContext("hoću da platim")).toBe("payment");
    expect(resolveDenisThinkingStepKeys("Mogu li da platim?")).toEqual([
      "ai.chat.thinking.payment",
    ]);
  });

  it("maps pause phrases", () => {
    expect(resolveDenisThinkingContext("dođi za 5 min")).toBe("pause");
    expect(isGuestPauseMessage("nisam još")).toBe(true);
    expect(resolveDenisThinkingStepKeys("dođi za 5 min")).toEqual([
      "ai.chat.thinking.pause",
    ]);
  });

  it("maps status and order intents", () => {
    expect(resolveDenisThinkingStepKeys("Kad stiže moj burger?")).toEqual([
      "ai.chat.thinking.status",
    ]);
    expect(resolveDenisThinkingStepKeys("Hoću dva piva")).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.order",
    ]);
  });

  it("caps thinking steps at two", () => {
    expect(MAX_DENIS_THINKING_STEPS).toBe(2);
    expect(
      capDenisThinkingStepKeys([
        "ai.chat.thinking.menu",
        "ai.chat.thinking.recommend",
        "ai.chat.thinking.llm",
      ])
    ).toEqual(["ai.chat.thinking.menu", "ai.chat.thinking.recommend"]);
  });

  it("uses personalized steps for returning guests and allergy questions", () => {
    expect(
      resolveDenisThinkingStepKeys("sta imate", {
        isReturningGuest: true,
      })
    ).toEqual([
      "ai.chat.thinking.favorites",
      "ai.chat.thinking.menu",
    ]);

    expect(resolveDenisThinkingStepKeys("Hoću dva piva")).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.order",
    ]);

    expect(
      resolveDenisThinkingStepKeys("Da li imate nešto bez lešnika?")
    ).toEqual(["ai.chat.thinking.allergy", "ai.chat.thinking.menu"]);

    expect(
      resolveDenisThinkingStepKeys("Hoću dva piva", {
        isLargeOrder: true,
      })
    ).toEqual([
      "ai.chat.thinking.largeOrder",
      "ai.chat.thinking.menu",
    ]);
  });

  it("uses 2.4s step rotation interval", () => {
    expect(DENIS_THINKING_STEP_MS).toBe(2400);
  });
});
