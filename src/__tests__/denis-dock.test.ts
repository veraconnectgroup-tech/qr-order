import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildDenisDock } from "@/lib/denis/loop/build-denis-dock";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { projectTableSessionView } from "@/lib/denis/loop/project-view";
import type { FoldMeta, TableSessionState } from "@/lib/denis/loop/types";

const now = Date.parse("2026-05-28T12:30:00.000Z");

function baseState(
  overrides: Partial<TableSessionState["commerce"]> = {}
): TableSessionState {
  return {
    table: { id: "table-1", name: "Table 4", token: "qr-token" },
    session: {
      id: "session-1",
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
      ...overrides,
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

const meta = (phase: FoldMeta["phase"]): FoldMeta => ({
  truthHash: "abc",
  orderCount: 1,
  phase,
  tableSessionId: "session-1",
  draftAiSessionId: "ai-1",
});

describe("buildDenisDock D1", () => {
  it("shows browse headline with recommend chips when no orders", () => {
    const dock = buildDenisDock({
      state: baseState(),
      meta: meta("browsing"),
      situation: null,
      language: "sr",
      nowMs: now,
    });

    expect(dock.headline).toContain("Pregledajte meni");
    expect(dock.chips.some((chip) => chip.action === "chip-recommend")).toBe(
      true
    );
    expect(dock.urgency).toBe("idle");
  });

  it("shows preparing headline with ETA", () => {
    const dock = buildDenisDock({
      state: baseState({
        orders: [
          {
            id: "order-1",
            orderNumber: 7,
            status: "preparing",
            paymentStatus: "unpaid",
            estimatedPrepMinutes: 8,
            createdAt: "2026-05-28T12:22:00.000Z",
            items: [{ productName: "Burger", quantity: 1 }],
          },
        ],
      }),
      meta: meta("waiting"),
      situation: null,
      language: "sr",
      nowMs: now,
    });

    expect(dock.headline).toContain("Burger");
    expect(dock.headline).toContain("~8 min");
    expect(dock.urgency).toBe("active");
    expect(dock.chips.some((chip) => chip.action === "chip-add-drink-wait")).toBe(
      true
    );
  });

  it("shows ready headline and alert urgency", () => {
    const dock = buildDenisDock({
      state: baseState({
        orders: [
          {
            id: "order-1",
            orderNumber: 7,
            status: "ready",
            paymentStatus: "unpaid",
            estimatedPrepMinutes: null,
            createdAt: "2026-05-28T12:10:00.000Z",
            items: [{ productName: "Pivo", quantity: 2 }],
          },
        ],
      }),
      meta: meta("waiting"),
      situation: {
        headline: "ready",
        orders: [],
        hasReadyOrder: true,
        hasActiveKitchen: false,
      },
      language: "sr",
      nowMs: now,
    });

    expect(dock.headline).toContain("spremni");
    expect(dock.urgency).toBe("alert");
  });

  it("shows late empathy headline when prep exceeds ETA buffer", () => {
    const dock = buildDenisDock({
      state: baseState({
        orders: [
          {
            id: "order-1",
            orderNumber: 7,
            status: "preparing",
            paymentStatus: "unpaid",
            estimatedPrepMinutes: 10,
            createdAt: "2026-05-28T12:00:00.000Z",
            items: [{ productName: "Pizza", quantity: 1 }],
          },
        ],
      }),
      meta: meta("waiting"),
      situation: null,
      language: "sr",
      nowMs: now,
    });

    expect(dock.headline).toContain("strpljenju");
    expect(dock.urgency).toBe("alert");
  });

  it("projects dock on table session view", () => {
    const state = baseState({
      orders: [
        {
          id: "order-1",
          orderNumber: 7,
          status: "preparing",
          paymentStatus: "unpaid",
          estimatedPrepMinutes: 12,
          createdAt: "2026-05-28T12:20:00.000Z",
          items: [{ productName: "Craft IPA", quantity: 2 }],
        },
      ],
    });

    const view = projectTableSessionView(state, meta("waiting"), null, {
      sessionId: "session-1",
      venueName: "Demo Bistro",
      language: "sr",
    });

    expect(view.dock.headline).toContain("Craft IPA");
    expect(view.dock.chips.length).toBeGreaterThan(0);
    expect(view.chrome.headline).toBe(view.dock.headline);
  });
});
