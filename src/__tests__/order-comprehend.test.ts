import { describe, expect, it } from "vitest";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { applyOrderComprehend } from "@/lib/denis/cognition/order";
import type { AiStructuredResponse } from "@/lib/ai/types";

const catalog: AiCatalog = {
  menuText: "Espresso €3.50",
  productMap: {
    p1: { id: "p1", name: "Espresso", price: 3.5, imageUrl: null },
  },
  catalog: {
    p1: {
      id: "p1",
      name: "Espresso",
      price: 3.5,
      imageUrl: null,
      menuSection: "drinks",
      taxRate: null,
      allergens: [],
      modifierGroups: [],
      requiresServeSize: false,
      serveSizePresets: [],
      allowCustomServeSize: false,
    },
  },
  currency: "EUR",
  cachedAt: new Date().toISOString(),
};

describe("applyOrderComprehend (ADR-034-A.1)", () => {
  it("applies proposed items without gap patching (waiter owns gaps)", () => {
    const structured: AiStructuredResponse = {
      intent: "order",
      recommendations: [],
      proposedItems: [
        {
          productId: "p1",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
        },
      ],
      quickReplies: [],
      submitOrder: false,
      message: "Added espresso.",
    };

    const result = applyOrderComprehend({
      userMessage: "one espresso please",
      allowOrdering: true,
      orderDraft: initDraftFromStorage(null),
      catalog,
      structured,
      priorMessages: [],
      language: "en",
    });

    expect(result.cartActions.length).toBeGreaterThan(0);
    expect(result.draft.items.length).toBe(1);
    expect(result.intent).toBe("order");
    expect(result.assistantMessage).not.toMatch(/Pilsner|Weizen/i);
  });
});
