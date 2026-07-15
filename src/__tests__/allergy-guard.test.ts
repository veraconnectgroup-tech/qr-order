import { describe, expect, it } from "vitest";
import {
  assessWaiterObligation,
  mergeTableSessionObligation,
} from "@/lib/denis/cognition/waiter";
import {
  checkAllergyConflict,
  isAllergyAcknowledged,
  isGuestAllergyRelatedMessage,
  parseAllergenExclusionsFromText,
} from "@/lib/denis/cognition/safety/allergy-guard";
import { retrieveMenuEvidence } from "@/lib/denis/cognition/context/retrievers/menu-rag";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import type { TableSessionState } from "@/lib/denis/loop/types";

const PIZZA_ID = "11111111-1111-4111-8111-111111111111";

function baseState(): TableSessionState {
  return {
    table: { id: "t1", name: "Table 1", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [],
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    guest: emptyGuestMemoryProjection({
      allergyLabels: ["gluten"],
      preferredLanguage: "sr",
      visitCount: 1,
    }),
    conversation: {
      flowNodeId: "recap",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("allergy guard F2", () => {
  it("detects gluten conflict in cart", () => {
    const guard = checkAllergyConflict({
      cartItems: [
        {
          productId: PIZZA_ID,
          productName: "Pizza Margherita",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 12,
        },
      ],
      knownAllergens: ["gluten"],
      products: new Map([
        [
          PIZZA_ID,
          {
            id: PIZZA_ID,
            name: "Pizza Margherita",
            allergens: ["gluten"],
          },
        ],
      ]),
      language: "sr",
    });

    expect(guard.safe).toBe(false);
    expect(guard.conflicts[0]?.severity).toBe("warn");
    expect(guard.message).toMatch(/gluten/i);
    expect(guard.message).toMatch(/jeste li sigurni/i);
  });

  it("creates allergy_warning obligation gap before submit", () => {
    const obligation = assessWaiterObligation({
      cartLines: [
        {
          productId: PIZZA_ID,
          productName: "Pizza",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 12,
        },
      ],
      pendingSlot: null,
      language: "sr",
      atRecap: true,
      allergyGuard: {
        safe: false,
        conflicts: [
          {
            productId: PIZZA_ID,
            productName: "Pizza",
            allergen: "Gluten",
            severity: "warn",
          },
        ],
        message: "Pizza sadrži Gluten — jeste li sigurni?",
      },
    });

    expect(obligation.primaryGap).toBe("allergy_warning");
    expect(obligation.canConfirm).toBe(false);
    expect(obligation.gaps[0]?.kind).toBe("allergy_warning");
  });

  it("allows confirm after guest acknowledges allergy warning", () => {
    const obligation = assessWaiterObligation({
      cartLines: [
        {
          productId: PIZZA_ID,
          productName: "Pizza",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 12,
        },
      ],
      pendingSlot: null,
      language: "sr",
      atRecap: true,
      allergyGuard: {
        safe: false,
        conflicts: [
          {
            productId: PIZZA_ID,
            productName: "Pizza",
            allergen: "Gluten",
            severity: "warn",
          },
        ],
        message: "Pizza sadrži Gluten — jeste li sigurni?",
      },
      allergyAcknowledged: true,
    });

    expect(obligation.gaps.some((gap) => gap.kind === "allergy_warning")).toBe(
      false
    );
    expect(obligation.canConfirm).toBe(true);
  });

  it("parses chat allergy declarations", () => {
    expect(parseAllergenExclusionsFromText("bez glutena molim")).toContain(
      "gluten"
    );
    expect(
      parseAllergenExclusionsFromText("imam alergiju na kikiriki")
    ).toContain("peanuts");
    expect(parseAllergenExclusionsFromText("bez lešnika")).toContain("nuts");
    expect(
      isGuestAllergyRelatedMessage("Da li imate nešto bez lešnika?")
    ).toBe(true);
    expect(isGuestAllergyRelatedMessage("jedno veliko pivo")).toBe(false);
  });

  it("detects guest acknowledgment phrases", () => {
    expect(isAllergyAcknowledged("znam, hoću ipak")).toBe(true);
    expect(isAllergyAcknowledged("ne, hvala")).toBe(false);
  });

  it("filters menu RAG by session allergens", () => {
    const catalog: MenuRagCatalog = {
      [PIZZA_ID]: {
        id: PIZZA_ID,
        name: "Pizza",
        price: 10,
        imageUrl: null,
        menuSection: "food" as const,
        allergens: ["gluten"],
        taxRate: 19,
        modifierGroups: [],
        requiresServeSize: false,
        serveSizePresets: [],
        allowCustomServeSize: false,
      },
      "22222222-2222-4222-8222-222222222222": {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Salata",
        price: 8,
        imageUrl: null,
        menuSection: "food" as const,
        allergens: [],
        taxRate: 19,
        modifierGroups: [],
        requiresServeSize: false,
        serveSizePresets: [],
        allowCustomServeSize: false,
      },
    };

    const rag = retrieveMenuEvidence("pizza", catalog, {
      sessionExcludedAllergens: ["gluten"],
    });

    expect(rag.productIds).not.toContain(PIZZA_ID);
    expect(rag.productIds).toContain("22222222-2222-4222-8222-222222222222");
  });

  it("merge obligation surfaces allergy gap for gluten guest with pizza", () => {
    const state = baseState();
    state.commerce.cart.ai.draft.items = [
      {
        productId: PIZZA_ID,
        productName: "Pizza",
        quantity: 1,
        serveSize: null,
        modifierIds: [],
        notes: "",
        lineTotal: 12,
      },
    ];

    const obligation = mergeTableSessionObligation({
      state,
      source: "turn",
      language: "sr",
      atRecap: true,
      allergyGuard: {
        safe: false,
        conflicts: [
          {
            productId: PIZZA_ID,
            productName: "Pizza",
            allergen: "Gluten",
            severity: "warn",
          },
        ],
        message: "Pizza sadrži Gluten — jeste li sigurni?",
      },
    });

    expect(obligation.primaryGap).toBe("allergy_warning");
  });
});
