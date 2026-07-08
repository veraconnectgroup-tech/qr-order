import { describe, expect, it } from "vitest";
import {
  capDenisThinkingStepKeys,
  DENIS_THINKING_STEP_MS,
  DENIS_THINKING_WAIT_KEY,
  MAX_DENIS_THINKING_STEPS,
  resolveDenisThinkingContext,
} from "@/lib/guest/denis-thinking-steps";
import {
  enrichTurnThinkingStepKeys,
  resolveTurnThinkingStepKeys,
} from "@/lib/denis/runtime/resolve-turn-thinking-steps";
import {
  isGuestPauseMessage,
  isMenuBrowseMessage,
} from "@/lib/guest/denis-guest-recovery";

describe("denis-thinking-steps", () => {
  it("maps menu browse phrases to menu context", () => {
    expect(resolveDenisThinkingContext("sta imate")).toBe("menu");
    expect(resolveDenisThinkingContext("Šta imate na meniju?")).toBe("menu");
    expect(isMenuBrowseMessage("preporuči mi pivo")).toBe(true);
  });

  it("maps payment intent", () => {
    expect(resolveDenisThinkingContext("hoću da platim")).toBe("payment");
  });

  it("maps pause phrases", () => {
    expect(resolveDenisThinkingContext("dođi za 5 min")).toBe("pause");
    expect(isGuestPauseMessage("nisam još")).toBe(true);
  });

  it("uses honest wait key until server preview arrives", () => {
    expect(DENIS_THINKING_WAIT_KEY).toBe("ai.chat.thinking.quick");
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

  it("uses 2.4s step rotation interval", () => {
    expect(DENIS_THINKING_STEP_MS).toBe(2400);
  });
});

describe("server turn thinking steps", () => {
  it("maps status intent from turn plan", () => {
    expect(
      resolveTurnThinkingStepKeys({
        kind: "template_tell",
        requiresLlm: false,
        suppressUpsell: false,
        reason: "commerce.status.open_order",
      })
    ).toEqual(["ai.chat.thinking.status"]);
  });

  it("adds favorites only when guest memory is loaded for a menu turn", () => {
    const keys = enrichTurnThinkingStepKeys(
      ["ai.chat.thinking.menu", "ai.chat.thinking.recommend"],
      {
        kind: "relational_perceive",
        requiresLlm: true,
        suppressUpsell: false,
        reason: "vague_recommend",
      },
      {
        guestMemory: {
          allergies: [],
          favoriteItems: ["Aperol Spritz"],
          language: "sr",
          favoriteProductIds: [],
          allergySheetIds: [],
          allergyLabels: [],
          preferredLanguage: "sr",
          visitCount: 3,
          lastVisitItemNames: ["Aperol Spritz"],
          lastVisit: "2026-01-01",
          lastVisitAt: "2026-01-01",
          avgSpend: 24,
          mood: null,
          hasMemoryConsent: true,
        },
      }
    );

    expect(keys[0]).toBe("ai.chat.thinking.favorites");
    expect(keys).toHaveLength(2);
  });

  it("does not add favorites without memory consent", () => {
    const keys = enrichTurnThinkingStepKeys(
      ["ai.chat.thinking.menu", "ai.chat.thinking.recommend"],
      {
        kind: "relational_perceive",
        requiresLlm: true,
        suppressUpsell: false,
        reason: "vague_recommend",
      },
      {
        guestMemory: {
          allergies: [],
          favoriteItems: ["Aperol Spritz"],
          language: "sr",
          favoriteProductIds: [],
          allergySheetIds: [],
          allergyLabels: [],
          preferredLanguage: "sr",
          visitCount: 3,
          lastVisitItemNames: [],
          lastVisit: null,
          lastVisitAt: null,
          avgSpend: null,
          mood: null,
          hasMemoryConsent: false,
        },
      }
    );

    expect(keys).toEqual([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.recommend",
    ]);
  });

  it("adds allergy step only when message mentions allergens", () => {
    expect(
      resolveTurnThinkingStepKeys(
        {
          kind: "relational_perceive",
          requiresLlm: true,
          suppressUpsell: false,
          reason: "conversation.pure_social",
        },
        null,
        "Da li imate nešto bez lešnika?"
      )
    ).toEqual(["ai.chat.thinking.allergy", "ai.chat.thinking.menu"]);
  });
});
