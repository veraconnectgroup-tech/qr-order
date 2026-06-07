import { describe, expect, it } from "vitest";
import {
  resolveDenisThinkingContext,
  resolveDenisThinkingStepKeys,
} from "@/lib/guest/denis-thinking-steps";

describe("denis-thinking-steps", () => {
  it("maps menu questions to menu + recommend steps", () => {
    expect(resolveDenisThinkingContext("Šta imate na meniju?")).toBe("menu");
    expect(resolveDenisThinkingStepKeys("preporuči mi pivo")).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.recommend",
    ]);
  });

  it("maps payment and status intents", () => {
    expect(resolveDenisThinkingContext("Mogu li da platim?")).toBe("payment");
    expect(resolveDenisThinkingStepKeys("Kad stiže moj burger?")).toEqual([
      "ai.chat.thinking.status",
    ]);
  });

  it("maps order intent to menu then order", () => {
    expect(resolveDenisThinkingStepKeys("Hoću dva piva")).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.order",
    ]);
  });
});
