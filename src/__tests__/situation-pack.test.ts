import { describe, expect, it } from "vitest";
import { beliefGraph, belief } from "@/lib/denis/cognition/beliefs/belief-types";
import { CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

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
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "collect",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: "Koju veličinu piva — 0.3L ili 0.5L?",
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...overrides,
  };
}

describe("ADR-031 Situation Pack", () => {
  it("includes process phase, flow node, and dialogue frame", () => {
    const beliefs = beliefGraph([
      belief(CORE_BELIEF_KEYS.conversationMode, "ordering"),
      belief(CORE_BELIEF_KEYS.conversationAwaiting, "serve_size"),
      belief(CORE_BELIEF_KEYS.commercePressure, "open"),
      belief(CORE_BELIEF_KEYS.commercePendingSlot, "serve_size"),
    ]);

    const pack = buildSituationPack({
      state: baseState(),
      beliefs,
      sessionPhase: "ordering",
      flowNodeId: "collect",
    });

    expect(pack).toContain("SITUATION PACK");
    expect(pack).toContain("session.phase: ordering");
    expect(pack).toContain("flow_node: collect");
    expect(pack).toContain("conversation.awaiting: serve_size");
    expect(pack).toContain("last_denis_message:");
    expect(pack).toContain("PHASE BEHAVIOR");
  });

  it("includes transcript window when provided", () => {
    const pack = buildSituationPack({
      state: baseState(),
      beliefs: beliefGraph([]),
      sessionPhase: "ordering",
      transcript: [
        { role: "user", content: "pivo" },
        { role: "assistant", content: "Koju veličinu?" },
        { role: "user", content: "0.5" },
      ],
    });

    expect(pack).toContain("RECENT TRANSCRIPT");
    expect(pack).toContain("Guest: pivo");
    expect(pack).toContain("Denis: Koju veličinu?");
    expect(pack).toContain("Guest: 0.5");
  });

  it("includes open orders and waiting phase behavior", () => {
    const pack = buildSituationPack({
      state: baseState({
        commerce: {
          orders: [
            {
              id: "o1",
              orderNumber: 42,
              status: "preparing",
              paymentStatus: "paid",
              estimatedPrepMinutes: 8,
              createdAt: "2026-05-29T12:00:00.000Z",
              items: [{ productName: "Pils", quantity: 1 }],
            },
          ],
          cart: {
            ai: emptyCartState(),
            visibleLines: [],
          },
        },
      }),
      beliefs: beliefGraph([]),
      sessionPhase: "waiting",
      flowNodeId: "post_submit",
    });

    expect(pack).toContain("OPEN TABLE ORDERS");
    expect(pack).toContain("#42 preparing");
    expect(pack).toContain("Orders in kitchen");
  });

  it("includes order draft pending block", () => {
    const draftContext = [
      "PENDING ORDER ITEM (needs guest choice):",
      "- 1x Pivo [prod-pivo]",
      "  missing serve_size: 0.3L | 0.5L",
    ].join("\n");

    const pack = buildSituationPack({
      state: baseState(),
      beliefs: beliefGraph([
        belief(CORE_BELIEF_KEYS.commercePendingSlot, "serve_size"),
      ]),
      sessionPhase: "ordering",
      orderDraftContext: draftContext,
    });

    expect(pack).toContain("PENDING ORDER ITEM");
    expect(pack).toContain("missing serve_size");
  });

  it("includes VKG pairing block when provided", () => {
    const pack = buildSituationPack({
      state: baseState(),
      beliefs: beliefGraph([]),
      vkgPairingBlock:
        "VKG PAIRING (verified menu — suggest naturally when guest orders food/drink):\n- Weizen — goes with schnitzel",
    });

    expect(pack).toContain("VKG PAIRING");
    expect(pack).toContain("Weizen");
  });
});
