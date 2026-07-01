import { describe, expect, it } from "vitest";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { buildViewHeadline } from "@/lib/denis/loop/project-view-layers";
import type { OrderFact, TableSessionState } from "@/lib/denis/loop/types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  buildPartyDockHeadline,
  buildPartyIncompleteMessage,
  derivePartyIntelligence,
  detectRoundOrderIntent,
} from "@/lib/denis/venue/party/derive-party-intelligence";
import { canCurrentDeviceConfirmOrder } from "@/lib/denis/venue/party/resolve-shared-session";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";

const NOW = new Date("2026-06-27T20:00:00.000Z").getTime();

function party(overrides: Partial<TablePartyModel> = {}): TablePartyModel {
  return {
    tableSessionId: "sess-1",
    partyMode: "per_device",
    sharedAiSessionId: null,
    activeDeviceCount: 4,
    currentDeviceFingerprint: "dev-a",
    isCurrentDevicePrimary: true,
    devices: [
      {
        deviceFingerprint: "dev-a",
        aiSessionId: "ai-a",
        displayName: null,
        isPrimary: true,
        manualCartRevision: 0,
        manualCartSnapshot: null,
        lastActiveAt: new Date(NOW).toISOString(),
      },
      {
        deviceFingerprint: "dev-b",
        aiSessionId: "ai-b",
        displayName: null,
        isPrimary: false,
        manualCartRevision: 0,
        manualCartSnapshot: null,
        lastActiveAt: new Date(NOW).toISOString(),
      },
      {
        deviceFingerprint: "dev-c",
        aiSessionId: "ai-c",
        displayName: null,
        isPrimary: false,
        manualCartRevision: 0,
        manualCartSnapshot: null,
        lastActiveAt: new Date(NOW).toISOString(),
      },
      {
        deviceFingerprint: "dev-d",
        aiSessionId: "ai-d",
        displayName: null,
        isPrimary: false,
        manualCartRevision: 0,
        manualCartSnapshot: null,
        lastActiveAt: new Date(NOW).toISOString(),
      },
    ],
    ...overrides,
  };
}

function order(
  partial: Partial<OrderFact> & Pick<OrderFact, "id">
): OrderFact {
  return {
    orderNumber: 1,
    status: "pending",
    paymentStatus: "unpaid",
    estimatedPrepMinutes: null,
    createdAt: new Date(NOW - 8 * 60_000).toISOString(),
    items: [{ productName: "Burger", quantity: 1 }],
    ...partial,
  };
}

function baseState(overrides: Partial<TableSessionState> = {}): TableSessionState {
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
    commerce: { orders: [], cart: { ai: emptyCartState(), visibleLines: [] } },
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
      flowNodeId: "browse",
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

describe("party intelligence G3", () => {
  it("counts per-device orders for all four guests", () => {
    const facts = derivePartyIntelligence({
      party: party(),
      orders: [
        order({ id: "o1", deviceFingerprint: "dev-a" }),
        order({ id: "o2", deviceFingerprint: "dev-b" }),
        order({ id: "o3", deviceFingerprint: "dev-c" }),
        order({ id: "o4", deviceFingerprint: "dev-d" }),
      ],
      nowMs: NOW,
    });

    expect(facts).toMatchObject({
      partySize: 4,
      devicesWithOrder: 4,
      orderedRatio: 1,
      partyMode: "per_device",
      isPartyIncomplete: false,
    });
  });

  it("4 devices, 3 ordered → party_incomplete on lagging device only", () => {
    const facts = derivePartyIntelligence({
      party: party({ currentDeviceFingerprint: "dev-d" }),
      orders: [
        order({ id: "o1", deviceFingerprint: "dev-a" }),
        order({ id: "o2", deviceFingerprint: "dev-b" }),
        order({ id: "o3", deviceFingerprint: "dev-c" }),
      ],
      nowMs: NOW,
    });

    expect(facts?.devicesWithOrder).toBe(3);
    expect(facts?.isPartyIncomplete).toBe(true);
    expect(facts?.isPartyIncompleteForCurrentDevice).toBe(true);
    expect(facts?.currentDeviceHasOrdered).toBe(false);
    expect(buildPartyIncompleteMessage(facts!)).toBe(
      "Izgleda da svi već naručili — smem li i vama pomoći?"
    );
  });

  it("does not nudge devices that already ordered in incomplete party", () => {
    const facts = derivePartyIntelligence({
      party: party({ currentDeviceFingerprint: "dev-a" }),
      orders: [
        order({ id: "o1", deviceFingerprint: "dev-a" }),
        order({ id: "o2", deviceFingerprint: "dev-b" }),
        order({ id: "o3", deviceFingerprint: "dev-c" }),
      ],
      nowMs: NOW,
    });

    expect(facts?.isPartyIncomplete).toBe(true);
    expect(facts?.isPartyIncompleteForCurrentDevice).toBe(false);
  });

  it("treats shared cart as one order for the whole table", () => {
    const facts = derivePartyIntelligence({
      party: party({ partyMode: "shared_cart", activeDeviceCount: 3 }),
      orders: [order({ id: "o1", deviceFingerprint: "dev-a" })],
      nowMs: NOW,
    });

    expect(facts?.devicesWithOrder).toBe(3);
    expect(facts?.isPartyIncomplete).toBe(false);
  });

  it("primary device confirms shared_cart orders", () => {
    expect(
      canCurrentDeviceConfirmOrder({
        partyMode: "shared_cart",
        isCurrentDevicePrimary: true,
      })
    ).toBe(true);
    expect(
      canCurrentDeviceConfirmOrder({
        partyMode: "shared_cart",
        isCurrentDevicePrimary: false,
      })
    ).toBe(false);
  });

  it("detects round order intent", () => {
    expect(detectRoundOrderIntent("Naručujem za ceo sto")).toBe(true);
    expect(detectRoundOrderIntent("Dva piva")).toBe(false);
  });

  it("compiles party beliefs", () => {
    const graph = compileBeliefs({
      state: baseState({
        party: party(),
        commerce: {
          orders: [order({ id: "o1", deviceFingerprint: "dev-a" })],
          cart: { ai: emptyCartState(), visibleLines: [] },
        },
      }),
      guestMessage: "",
      nowMs: NOW,
    });

    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.partySize)).toBe(4);
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.partyMode)).toBe("per_device");
  });

  it("adds party block to situation pack", () => {
    const state = baseState({
      party: party({ currentDeviceFingerprint: "dev-d" }),
      commerce: {
        orders: [
          order({ id: "o1", deviceFingerprint: "dev-a" }),
          order({ id: "o2", deviceFingerprint: "dev-b" }),
        ],
        cart: { ai: emptyCartState(), visibleLines: [] },
      },
    });
    const pack = buildSituationPack({
      state,
      beliefs: beliefGraph([]),
      sessionPhase: "ordering",
      guestMessage: "Naručujem za ceo sto",
    });

    expect(pack).toContain("PARTY:");
    expect(pack).toContain("round_order_intent");
    expect(pack).toContain("Mode: per_device");
  });

  it("ranks party_incomplete proactive candidate on lagging device", () => {
    const facts = derivePartyIntelligence({
      party: party({ currentDeviceFingerprint: "dev-d" }),
      orders: [
        order({ id: "o1", deviceFingerprint: "dev-a" }),
        order({ id: "o2", deviceFingerprint: "dev-b" }),
        order({ id: "o3", deviceFingerprint: "dev-c" }),
      ],
      nowMs: NOW,
    });

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: { sessionPhase: "ordering", language: "sr" },
      partyFacts: facts,
      messages: {
        browse: "",
        dessert: "",
        slowKitchen: "",
        guestWelcome: "",
        browseFollowUp: "",
        billPrompt: "",
        orderDelay: "",
        popularityPair: "",
      },
      now: NOW,
    });

    const nudge = ranked.find((row) => row.nudge.kind === "party_incomplete");
    expect(nudge).toBeDefined();
    expect(nudge?.nudge.message).toContain("smem li i vama pomoći");
  });

  it("shows party dock headline during browsing", () => {
    const state = baseState({
      party: party({ currentDeviceFingerprint: "dev-d" }),
      commerce: {
        orders: [order({ id: "o1", deviceFingerprint: "dev-a" })],
        cart: { ai: emptyCartState(), visibleLines: [] },
      },
    });

    const headline = buildViewHeadline(state, null, "browsing");
    expect(headline).toBe("1/4 naručilo | Čekamo ostale?");
    expect(buildPartyDockHeadline(
      derivePartyIntelligence({
        party: state.party!,
        orders: state.commerce.orders.map((row) => ({
          id: row.id,
          status: row.status,
          createdAt: row.createdAt,
          deviceFingerprint: row.deviceFingerprint,
          items: row.items,
        })),
        nowMs: NOW,
      })
    )).toBe("1/4 naručilo | Čekamo ostale?");
  });
});
