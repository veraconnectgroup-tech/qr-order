import { describe, expect, it, vi } from "vitest";
import {
  buildPosBridgeItems,
  computePosBridgeTotal,
  formatPosOfflineAlert,
  type PosBridgeConfig,
} from "@/lib/integrations/pos-bridge";
import { getPosAdapter, POS_OUTBOUND_ADAPTERS } from "@/lib/pos/adapter-registry";
import {
  buildPosInboundTimelineMessage,
  buildPosPeerManualFromOrders,
  posInboundDraftToPeerManual,
} from "@/lib/pos/inbound/peer-cart";
import {
  resolvePosConflictBlocking,
  buildPosStaffEditBlockingMessage,
} from "@/lib/pos/conflict-scene";
import {
  applyPosBroadcastEvent,
  createProvisionalMap,
  mergeProvisionalToFinal,
} from "@/lib/pos/provisional-merge";
import {
  isPosBridgeEnabled,
  resolveActivePosProvider,
} from "@/lib/pos/feature-flags";
import { pushProvisionalOrderToPos } from "@/lib/pos/outbound/push-provisional-order";
import { buildViewLayers } from "@/lib/denis/loop/project-view-layers";
import { buildFoldMeta } from "@/lib/denis/loop/compute-truth-hash";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { TableSessionState } from "@/lib/denis/loop/types";

const syncMocks = vi.hoisted(() => ({
  appendDenisTimelineEvent: vi.fn().mockResolvedValue({ id: "tl-1" }),
  markPosStaffEdit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/denis/platform/append-timeline-event", () => ({
  appendDenisTimelineEvent: syncMocks.appendDenisTimelineEvent,
}));

vi.mock("@/lib/pos/session-edit-store", () => ({
  markPosStaffEdit: syncMocks.markPosStaffEdit,
}));

function minimalSessionState(
  overrides?: Partial<TableSessionState["session"]>
): TableSessionState {
  return {
    table: { id: "t1", name: "Sto 7", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
      ...overrides,
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
  };
}

describe("POS bridge W2", () => {
  it("builds tax-aware payload for ćevapi + pivo order", () => {
    const items = buildPosBridgeItems(
      [
        { name: "Ćevapi", quantity: 2, unitPriceCents: 850, category: "food" },
        { name: "Pivo", quantity: 3, unitPriceCents: 350, category: "drinks" },
      ],
      19
    );

    expect(items).toHaveLength(2);
    expect(items[0]?.taxRate).toBe(19);
    expect(computePosBridgeTotal(items)).toBe(2 * 850 + 3 * 350);
  });

  it("formats offline POS staff alert", () => {
    const alert = formatPosOfflineAlert([
      { orderId: "o1", tableName: "Sto 4", queuedAt: new Date().toISOString() },
      { orderId: "o2", tableName: "Sto 7", queuedAt: new Date().toISOString() },
      { orderId: "o3", tableName: "Sto 2", queuedAt: new Date().toISOString() },
    ]);
    expect(alert).toContain("POS nedostupan");
    expect(alert).toContain("3");
  });

  it("returns disabled when autoSync is off", async () => {
    const { sendOrderToPos } = await import("@/lib/integrations/pos-bridge");
    const config: PosBridgeConfig = {
      provider: "generic_webhook",
      endpoint: "https://example.com/pos",
      apiKey: "test-key-12345678",
      autoSync: false,
      taxRate: 19,
    };
    const result = await sendOrderToPos(config, {
      externalOrderId: "x",
      items: [],
      total: 0,
      tableIdentifier: "T1",
      paymentMethod: "online",
      fiscalNote: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("POS bridge Prompt 39", () => {
  it("registers deliverect + skeleton outbound adapters", () => {
    expect(POS_OUTBOUND_ADAPTERS).toEqual(
      expect.arrayContaining(["deliverect", "lightspeed", "orderbird", "sumup"])
    );
    expect(getPosAdapter("lightspeed")).toBeDefined();
    expect(getPosAdapter("sumup")).toBeDefined();
  });

  it("builds Denis timeline message for POS inbound order", () => {
    const message = buildPosInboundTimelineMessage({
      tableName: "sto 7",
      items: [{ name: "Pilsner", quantity: 1 }],
    });
    expect(message).toContain("Pilsner");
    expect(message).toContain("sto 7");
    expect(message).toMatch(/Konobar dodao/i);
  });

  it("maps POS inbound draft to guest peer manual cart", () => {
    const draft = posInboundDraftToPeerManual({
      externalOrderId: "POS-1",
      items: [{ name: "Pilsner", quantity: 2, unitPrice: 3.5, total: 7 }],
      subtotal: 7,
      taxPercent: 19,
      taxAmount: 1.12,
      total: 7,
      paymentState: "UNPAID",
    });
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]?.productName).toBe("Pilsner");
    expect(draft.items[0]?.quantity).toBe(2);
  });

  it("shows blocking scene when staff edits table order", () => {
    const blocking = resolvePosConflictBlocking({
      staffEditActive: true,
      cartConflict: false,
    });
    expect(blocking?.reason).toBe("conflict");
    expect(buildPosStaffEditBlockingMessage("sr")).toContain(
      "Konobar upravo menja"
    );
  });

  it("merges provisional to final on guest confirm", () => {
    let map = createProvisionalMap();
    map = applyPosBroadcastEvent(map, {
      type: "provisional_order",
      payload: {
        clientOrderId: "client-1",
        locationId: "loc-1",
        tableId: "t-1",
        tableName: "T7",
        staffId: "staff-1",
        items: [{ productName: "Pilsner", quantity: 1 }],
        total: 3.5,
        createdAt: new Date().toISOString(),
      },
    });
    map = mergeProvisionalToFinal(map, "client-1", {
      orderId: "order-99",
      orderNumber: 128,
    });
    expect(map.size).toBe(0);
  });

  it("resolves active POS provider per location integrations", () => {
    expect(
      resolveActivePosProvider([
        { provider: "lightspeed", status: "disconnected" },
        { provider: "deliverect", status: "connected" },
      ])
    ).toBe("deliverect");
  });

  it("builds peer manual from pos-origin session orders", () => {
    const draft = buildPosPeerManualFromOrders([
      {
        id: "o1",
        orderNumber: 7,
        status: "accepted",
        paymentStatus: "pending",
        estimatedPrepMinutes: 8,
        createdAt: new Date().toISOString(),
        orderSource: "pos",
        items: [
          {
            productName: "Pilsner",
            quantity: 1,
            lineTotalCents: 350,
          },
        ],
      },
    ]);
    expect(draft.items[0]?.productName).toBe("Pilsner");
  });

  it("skeleton adapter skips provisional POS push", async () => {
    const result = await pushProvisionalOrderToPos({
      provider: "sumup",
      config: {},
      tableName: "T7",
      currency: "EUR",
      payload: {
        clientOrderId: "client-1",
        locationId: "loc-1",
        tableId: "t-1",
        tableName: "T7",
        staffId: "staff-1",
        items: [{ productName: "Pilsner", quantity: 1 }],
        total: 3.5,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.skipped).toBe(true);
  });
});

describe("POS bridge feature flags", () => {
  it("is disabled by default without env", () => {
    expect(isPosBridgeEnabled("any-location")).toBe(false);
  });
});

describe("POS bridge Denis integration", () => {
  it("projects blocking scene layer when staff edits POS order", () => {
    const state = minimalSessionState({ posStaffEditActive: true });
    const meta = buildFoldMeta(state, "s1", "ai-1", "ordering");
    const layers = buildViewLayers(state, meta, null, "sr");
    const blocking = layers.find((layer) => layer.kind === "blocking");

    expect(blocking?.reason).toBe("conflict");
    expect(blocking?.message).toContain("Konobar upravo menja");
  });

  it("syncs POS inbound to Denis timeline when ai session exists", async () => {
    syncMocks.appendDenisTimelineEvent.mockClear();
    syncMocks.markPosStaffEdit.mockClear();

    const { syncPosInboundToDenis } = await import(
      "@/lib/pos/inbound/sync-pos-inbound-to-denis"
    );

    const admin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { denis_shared_ai_session_id: "ai-session-1" },
        }),
      })),
    };

    const result = await syncPosInboundToDenis(admin as never, {
      tableSessionId: "ts-1",
      tableName: "sto 7",
      orderId: "order-1",
      orderNumber: 42,
      draft: {
        externalOrderId: "POS-99",
        items: [{ name: "Pilsner", quantity: 1, unitPrice: 3.5, total: 3.5 }],
        subtotal: 3.5,
        taxPercent: 19,
        taxAmount: 0.67,
        total: 3.5,
        paymentState: "UNPAID",
      },
    });

    expect(result.timelineAppended).toBe(true);
    expect(result.message).toMatch(/Konobar dodao.*Pilsner.*sto 7/i);
    expect(syncMocks.markPosStaffEdit).toHaveBeenCalledWith("ts-1");
    expect(syncMocks.appendDenisTimelineEvent).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        aiSessionId: "ai-session-1",
        eventType: "realtime.ingested",
      })
    );
  });
});
