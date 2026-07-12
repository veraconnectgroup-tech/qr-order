import { describe, expect, it } from "vitest";
import { AI_CONFIG } from "@/lib/ai/config";
import {
  buildSystemPrompt,
  estimateSystemPromptTokens,
  measureSystemPromptBlocks,
} from "@/lib/ai/build-system-prompt";

const BASE_INPUT = {
  orgName: "Skyline Lounge",
  menuText: "",
  language: "sr",
  venueMenuLocale: "de",
  guestMessage: "Dva piva molim",
  allowOrdering: true,
  omitFullMenu: true,
};

describe("buildSystemPrompt token budget", () => {
  it("static core stays under maxSystemPromptTokens without menu", () => {
    const tokens = estimateSystemPromptTokens(BASE_INPUT);
    expect(tokens).toBeLessThan(AI_CONFIG.maxSystemPromptTokens);
  });

  it("has 9 consolidated blocks (no menu)", () => {
    const blocks = measureSystemPromptBlocks(BASE_INPUT);
    expect(blocks.map((row) => row.id)).toEqual([
      "language_policy",
      "identity",
      "persona",
      "rules",
      "platform_contract",
      "conversation",
      "output_format",
      "situation_pack",
    ]);
  });

  it("always tells Denis he can help cancel/change an already-submitted order", () => {
    const prompt = buildSystemPrompt(BASE_INPUT);
    expect(prompt).toContain("CANCEL/CHANGE:");
    expect(prompt).toContain("before the kitchen accepts it");
  });

  it("merges dynamic context into situation_pack", () => {
    const prompt = buildSystemPrompt({
      ...BASE_INPUT,
      guestPrefs: { allergies: ["gluten"], mood: "celebrating" },
      orderContext: "ORDERS:\n- #42 Pilsner x2 status=preparing",
      orderDraftContext: "ITEMS ALREADY IN CART:\n- Pilsner 0.5L x1",
      browsingContext: "Guest scrolled drinks",
      playbookContext: "PLAYBOOK: upsell wine with steak",
    });

    expect(prompt).toContain("SITUATION PACK (truth — do not contradict):");
    expect(prompt).toContain("- allergies: gluten");
    expect(prompt).toContain("ITEMS ALREADY IN CART");
    expect(prompt).toContain("PLAYBOOK: upsell wine with steak");
    expect(prompt).not.toContain("GUEST LANGUAGE HINT:");
    expect(prompt).not.toContain("ORDER DRAFT:");
    expect(prompt).not.toContain("BROWSE-KONTEXT:");
    expect(prompt).not.toContain("EVIDENCE:");
  });

  it("includes POS capability awareness in situation pack when present", () => {
    const prompt = buildSystemPrompt({
      ...BASE_INPUT,
      capabilityAwarenessBlock:
        "POS CAPABILITIES — what you may actually promise a guest:\nYou CANNOT (say so honestly, never claim otherwise):\n- closing a bill in the POS — NOT possible today; be honest, say a staff member must handle it",
    });

    expect(prompt).toContain("POS CAPABILITIES");
    expect(prompt).toContain("closing a bill in the POS");
  });

  it("omits capability awareness from situation pack when absent", () => {
    const prompt = buildSystemPrompt(BASE_INPUT);
    expect(prompt).not.toContain("POS CAPABILITIES");
  });

  it("includes the connected-systems awareness block in situation pack when present", () => {
    const prompt = buildSystemPrompt({
      ...BASE_INPUT,
      integrationsAwarenessBlock:
        "CONNECTED SYSTEMS YOU CAN ACTUALLY USE:\n- Deliverect (point of sale)\nAnything not listed here is NOT connected — say so honestly if asked, never guess or assume a capability exists.",
    });

    expect(prompt).toContain("CONNECTED SYSTEMS YOU CAN ACTUALLY USE");
    expect(prompt).toContain("Deliverect");
  });

  it("omits connected-systems awareness from situation pack when absent", () => {
    const prompt = buildSystemPrompt(BASE_INPUT);
    expect(prompt).not.toContain("CONNECTED SYSTEMS YOU CAN ACTUALLY USE");
  });

  it("includes promo context in situation pack", () => {
    const prompt = buildSystemPrompt({
      ...BASE_INPUT,
      promoContext:
        "PROMO (verified active codes only — NEVER invent a code):\n- WELCOME10: 10% popusta [first_visit]",
    });

    expect(prompt).toContain("WELCOME10");
    expect(prompt).toContain("PROMO (verified active codes only");
  });

  it("passes through pre-built situation pack from evidenceBlock", () => {
    const pack =
      "SITUATION PACK (truth — do not contradict):\nPROCESS:\n- session.phase: ordering";
    const prompt = buildSystemPrompt({
      ...BASE_INPUT,
      evidenceBlock: pack,
      orderContext: "should-not-duplicate",
    });

    expect(prompt).toContain(pack);
    expect(prompt).not.toContain("should-not-duplicate");
  });

  it("reports per-block token counts for diagnostics", () => {
    const blocks = measureSystemPromptBlocks(BASE_INPUT);
    const blockSum = blocks.reduce((sum, row) => sum + row.tokens, 0);
    const full = estimateSystemPromptTokens(BASE_INPUT);
    // Block sum excludes "\n\n" join separators between sections.
    expect(full).toBeGreaterThanOrEqual(blockSum);
    expect(full - blockSum).toBeLessThanOrEqual(10);
    for (const row of blocks) {
      expect(row.tokens).toBeGreaterThan(0);
      expect(row.chars).toBeGreaterThan(0);
    }
  });

  it("includes menu_names hint when guest language differs from venue", () => {
    const prompt = buildSystemPrompt({
      ...BASE_INPUT,
      guestMessage: "I would like a beer please",
    });
    expect(prompt).toContain("menu_names:");
    expect(prompt).toContain("ORIGINAL venue menu dish names");
  });

  it("full dynamic turn still under budget without menu", () => {
    const tokens = estimateSystemPromptTokens({
      ...BASE_INPUT,
      guestPrefs: { allergies: ["gluten", "nuts"], mood: "date night" },
      orderContext: "ORDERS:\n- #42 Pilsner 0.5L x2 status=preparing",
      orderDraftContext: "ITEMS ALREADY IN CART:\n- Pilsner 0.5L x1",
      browsingContext: "Guest scrolled drinks section for 12s",
      playbookContext: "PLAYBOOK: upsell wine with steak",
      evidenceBlock: "CATALOG RAG:\n- Craft IPA [uuid-1] 5.50 EUR",
    });
    expect(tokens).toBeLessThan(AI_CONFIG.maxSystemPromptTokens);
  });
});
