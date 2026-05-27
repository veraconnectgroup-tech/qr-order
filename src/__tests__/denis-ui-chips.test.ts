import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  emptyCartDraft,
  emptyCartState,
} from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  buildNarrationFacts,
  resolveTurnQuickReplies,
  sanitizeNarrationOutput,
} from "@/lib/denis/runtime/narrate";

describe("UI chips M11", () => {
  it("adds yes/no chips for cart conflict template", () => {
    const reflexTurn = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "",
      flowNodeId: "recap",
      cartState: {
        ...emptyCartState(),
        draft: {
          cartRevision: 1,
          items: [
            {
              productId: "p-ai",
              productName: "Espresso",
              quantity: 1,
              serveSize: null,
              modifierIds: [],
              notes: "",
              lineTotal: 3.5,
              menuSection: "drinks",
            },
          ],
        },
      },
      manualCartDraft: {
        ...emptyCartDraft(),
        items: [
          {
            productId: "p-manual",
            productName: "Cola",
            quantity: 1,
            serveSize: "0.5L",
            modifierIds: [],
            notes: "",
            lineTotal: 4,
            menuSection: "drinks",
          },
        ],
      },
    });

    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "sr",
      reflexTurn,
    });
    const narration = sanitizeNarrationOutput(
      "Nevalidna poruka sa Pizza Hawaii.",
      facts
    );
    const chips = resolveTurnQuickReplies({
      reflexTurn,
      facts,
      narration,
      language: "sr",
    });

    expect(chips).toContain("Da, spoji");
    expect(chips).toContain("Ne, hvala");
  });

  it("preserves legacy size chips when no conflict", () => {
    const reflexTurn = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "cola",
      flowNodeId: "collect",
      cartState: emptyCartState(),
    });
    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "de",
      reflexTurn,
    });
    const narration = sanitizeNarrationOutput("Welche Größe?", facts);
    const chips = resolveTurnQuickReplies({
      reflexTurn,
      facts,
      narration,
      legacyQuickReplies: ["0.3L", "0.5L"],
      language: "de",
    });

    expect(chips).toEqual(["0.3L", "0.5L"]);
  });

  it("adds confirm chips on template fallback with added items", () => {
    const reflexTurn = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "espresso",
      flowNodeId: "collect",
      cartState: {
        ...emptyCartState(),
        draft: {
          cartRevision: 1,
          items: [
            {
              productId: "p1",
              productName: "Espresso",
              quantity: 1,
              serveSize: null,
              modifierIds: [],
              notes: "",
              lineTotal: 3.5,
              menuSection: "drinks",
            },
          ],
        },
      },
    });
    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "sr",
      reflexTurn,
      cartActions: [{ productName: "Espresso", quantity: 1 }],
    });
    const narration = sanitizeNarrationOutput(
      "Narudžbina je poslata sa Pizza Hawaii.",
      facts
    );
    const chips = resolveTurnQuickReplies({
      reflexTurn,
      facts,
      narration,
      language: "sr",
    });

    expect(chips).toContain("Potvrdi");
    expect(chips).toContain("Još nešto");
  });
});
