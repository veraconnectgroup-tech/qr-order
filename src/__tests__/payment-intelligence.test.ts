import { describe, expect, it } from "vitest";
import {
  buildSplitEqualPreview,
  resolvePaymentDeclinedRecovery,
  resolvePaymentSuggestion,
  resolveSplitBillSuggestion,
  isStripeDeclinedError,
} from "@/lib/denis/commerce/payment-intelligence";
import {
  mapTerminalPaymentStatus,
  resolveGuestTerminalPrompt,
} from "@/lib/stripe/terminal-context";
import { mergePaymentIntelligenceLayers } from "@/lib/scene/payment-intelligence-layers";
import type { ComposeSceneInput } from "@/lib/scene/types";

const baseInput = (): ComposeSceneInput => ({
  sessionId: "sess-1",
  tableName: "Sto 8",
  venueName: "Kafana",
  phase: "settling",
  markState: "idle",
  denisActive: true,
  sheetOpen: false,
  sheetTitle: "Denis",
  thinking: false,
  blocking: null,
  banners: [{ id: "settling-ready", message: "Ready to pay" }],
  inlineRecommendations: [],
  chips: [],
  situation: null,
});

describe("payment intelligence (Prompt 47)", () => {
  it("order > €50 → card recommendation", () => {
    const suggestion = resolvePaymentSuggestion({
      amountDue: 55,
      language: "sr",
      availableMethods: ["online", "at_bar"],
    });

    expect(suggestion?.tier).toBe("large");
    expect(suggestion?.message).toContain("karticom");
    expect(suggestion?.recommendedMethod).toBe("online");
  });

  it("order < €10 → card or cash suggestion", () => {
    const suggestion = resolvePaymentSuggestion({
      amountDue: 8,
      language: "sr",
      availableMethods: ["online", "at_bar"],
    });

    expect(suggestion?.tier).toBe("small");
    expect(suggestion?.message).toContain("gotovinom");
  });

  it("split 3 ways → equal cent-safe amounts", () => {
    const preview = buildSplitEqualPreview(100, 3);
    expect(preview.amounts).toEqual([33.34, 33.33, 33.33]);
    expect(preview.amounts.reduce((sum, n) => sum + n, 0)).toBeCloseTo(100, 2);
    expect(preview.perPerson).toBe(33.34);
  });

  it("declined card → Denis retry message", () => {
    const recovery = resolvePaymentDeclinedRecovery({ language: "sr" });
    expect(recovery.message).toContain("Probajte drugu");
    expect(recovery.suggestRetry).toBe(true);
    expect(
      isStripeDeclinedError({ type: "card_error", code: "card_declined" })
    ).toBe(true);
  });

  it("terminal prompt and processing status copy", () => {
    expect(resolveGuestTerminalPrompt("sr")).toContain("čitač");
    expect(mapTerminalPaymentStatus("processing", "sr")).toContain("obrađuje");
    expect(mapTerminalPaymentStatus("succeeded", "sr")).toBe("Uspelo!");
  });

  it("mergePaymentIntelligenceLayers adds suggestion banner in settling", () => {
    const merged = mergePaymentIntelligenceLayers(baseInput(), {
      phase: "settling",
      language: "sr",
      amountDue: 60,
      availableMethods: ["online", "at_bar"],
      terminalEligible: true,
      partySize: 3,
    });

    expect(
      merged.banners.some((banner) => banner.id === "payment-suggestion")
    ).toBe(true);
    expect(
      merged.banners.some((banner) => banner.id === "payment-terminal-ready")
    ).toBe(true);
    expect(
      merged.banners.some((banner) => banner.id === "payment-split-offer")
    ).toBe(true);
  });

  it("resolveSplitBillSuggestion exposes split mode chips", () => {
    const split = resolveSplitBillSuggestion({ language: "sr" });
    expect(split.prompt).toContain("podeliti");
    expect(split.chips.map((chip) => chip.label)).toEqual(
      expect.arrayContaining(["Po stavkama", "Jednako"])
    );
  });
});
