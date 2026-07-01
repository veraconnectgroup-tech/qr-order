import { describe, expect, it } from "vitest";
import {
  compileBeliefs,
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs";
import {
  deriveCommerceLifecycleFacts,
  formatCommerceGuestWaitingLine,
} from "@/lib/denis/cognition/beliefs/compile-commerce-lifecycle";
import { retrieveCommerceEvidence } from "@/lib/denis/cognition/context/retrievers/commerce-evidence";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const nowMs = Date.parse("2026-05-27T12:22:00.000Z");

const venueOps: VenueOpsBeliefs = {
  operatingMode: "normal",
  kdsStress: "normal",
  acceptingOrders: true,
  unavailableProductIds: [],
  staffHint: null,
  stationStress: [
    {
      station: "kitchen",
      stress: "high",
      activeCount: 4,
      avgWaitMinutes: 12,
    },
    {
      station: "bar",
      stress: "normal",
      activeCount: 2,
      avgWaitMinutes: 3,
    },
  ],
};

function baseState(
  overrides: Partial<TableSessionState> = {}
): TableSessionState {
  return {
    table: { id: "t1", name: "Table 8", token: "tok" },
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
      cart: {
        ai: emptyCartState(),
        visibleLines: [],
      },
    },
    venue: {
      ops: venueOps,
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "post_submit",
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
    ...overrides,
  };
}

describe("commerce lifecycle beliefs A3", () => {
  it("marks anyLate when wait exceeds ETA by 30%", () => {
    const facts = deriveCommerceLifecycleFacts(
      [
        {
          id: "o1",
          orderNumber: 17,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 14,
          createdAt: "2026-05-27T12:00:00.000Z",
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
      venueOps,
      nowMs
    );

    expect(facts.oldestWaitMinutes).toBe(22);
    expect(facts.anyLate).toBe(true);
    expect(facts.kitchenEtaMinutes).toBe(12);
    expect(facts.barEtaMinutes).toBe(3);
  });

  it("compiles lifecycle beliefs into belief graph", () => {
    const graph = compileBeliefs({
      state: baseState({
        commerce: {
          orders: [
            {
              id: "o1",
              orderNumber: 17,
              status: "preparing",
              paymentStatus: "paid",
              estimatedPrepMinutes: 14,
              createdAt: "2026-05-27T12:10:00.000Z",
              items: [{ productName: "Burger", quantity: 1 }],
            },
          ],
          cart: {
            ai: emptyCartState(),
            visibleLines: [],
          },
        },
      }),
      guestMessage: "",
      nowMs,
    });

    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.commerceAnyLate)).toBe(false);
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.commerceOldestWaitMinutes)).toBe(
      12
    );
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.commerceKitchenEta)).toBe(12);
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.commerceBarEta)).toBe(3);
  });

  it("sets allDelivered when every order is delivered", () => {
    const facts = deriveCommerceLifecycleFacts(
      [
        {
          id: "o1",
          orderNumber: 1,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: "2026-05-27T11:00:00.000Z",
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
      venueOps,
      nowMs
    );

    expect(facts.allDelivered).toBe(true);
    expect(facts.anyLate).toBe(false);
  });

  it("includes guest_waiting line in commerce evidence", () => {
    const onTrack = formatCommerceGuestWaitingLine(
      deriveCommerceLifecycleFacts(
        [
          {
            id: "o1",
            orderNumber: 17,
            status: "preparing",
            paymentStatus: "paid",
            estimatedPrepMinutes: 14,
            createdAt: "2026-05-27T12:10:00.000Z",
            items: [{ productName: "Burger", quantity: 1 }],
          },
        ],
        venueOps,
        nowMs
      )
    );

    expect(onTrack).toContain("guest_waiting: 12 min");
    expect(onTrack).toContain("on track");

    const evidence = retrieveCommerceEvidence(
      baseState({
        commerce: {
          orders: [
            {
              id: "o1",
              orderNumber: 17,
              status: "preparing",
              paymentStatus: "paid",
              estimatedPrepMinutes: 14,
              prepEstimateConfidence: "high",
              createdAt: "2026-05-27T12:00:00.000Z",
              items: [
                {
                  productName: "Burger",
                  quantity: 1,
                  productId: "burger-id",
                },
              ],
            },
          ],
          cart: {
            ai: emptyCartState(),
            visibleLines: [],
          },
        },
      }),
      null,
      null,
      { nowMs }
    );

    expect(evidence).toContain("guest_waiting: 22 min");
    expect(evidence).toContain("LATE, empathy needed");
  });
});

describe("compileBeliefs — sticky ordering mode", () => {
  it("keeps ordering mode for banter-looking typo during open commerce", () => {
    const graph = compileBeliefs({
      state: baseState({
        commerce: {
          orders: [],
          cart: {
            ai: emptyCartState(),
            visibleLines: [
              {
                productId: "p1",
                productName: "Pilsner",
                quantity: 1,
                lineTotal: 4.5,
                serveSize: null,
                modifierIds: [],
                notes: "",
              },
            ],
          },
        },
        conversation: {
          flowNodeId: "collect",
          foodUpsellAsked: false,
          dismissedNudges: [],
          lastAssistantMessage: null,
          pendingSlot: "serve_size",
          model: emptyConversationModel(),
          obligation: null,
        },
      }),
      guestMessage: "povo",
      nowMs,
    });

    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.conversationMode)).toBe(
      "ordering"
    );
  });

  it("keeps ordering mode for social banter while commerce pressure is open", () => {
    const graph = compileBeliefs({
      state: baseState({
        commerce: {
          orders: [],
          cart: {
            ai: emptyCartState(),
            visibleLines: [
              {
                productId: "p1",
                productName: "Pilsner",
                quantity: 1,
                lineTotal: 4.5,
                serveSize: null,
                modifierIds: [],
                notes: "",
              },
            ],
          },
        },
      }),
      guestMessage: "gde si legendo",
      nowMs,
    });

    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.conversationMode)).toBe(
      "ordering"
    );
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.commercePressure)).toBe("open");
  });
});
