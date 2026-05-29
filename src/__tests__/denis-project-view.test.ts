import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { projectTableSessionView } from "@/lib/denis/loop/project-view";
import type { FoldMeta, TableSessionState } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function timelineRow(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>
): DenisTimelineRow {
  return {
    id: `evt-${seq}`,
    ai_session_id: "ai-1",
    seq,
    event_type: eventType,
    payload,
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: `2026-05-28T12:00:0${seq}.000Z`,
  };
}

function buildFixtureState(
  timeline: DenisTimelineRow[]
): { state: TableSessionState; meta: FoldMeta } {
  const state: TableSessionState = {
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
      orders: [
        {
          id: "order-42",
          orderNumber: 42,
          status: "preparing",
          paymentStatus: "unpaid",
          estimatedPrepMinutes: 12,
          createdAt: "2026-05-28T12:00:00.000Z",
          items: [{ productName: "Craft IPA", quantity: 2 }],
        },
      ],
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
      flowNodeId: "recap",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
    },
    timeline,
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };

  const meta: FoldMeta = {
    truthHash: "abc",
    orderCount: 1,
    phase: "waiting",
    tableSessionId: "session-1",
    draftAiSessionId: "ai-1",
  };

  return { state, meta };
}

describe("projectTableSessionView Phase B.1", () => {
  it("keeps orders and transcript consistent with folded TRUTH", () => {
    const timeline = [
      timelineRow(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "Status porudžbine?",
          structuredIntent: "STATUS",
          ingestedAt: "2026-05-28T12:00:01.000Z",
        },
      }),
      timelineRow(2, "narration.sent", {
        type: "narration.sent",
        message: "Porudžbina #42 je u pripremi.",
        tier: "template",
      }),
    ];

    const { state, meta } = buildFixtureState(timeline);
    const view = projectTableSessionView(state, meta, null, {
      sessionId: "session-1",
      venueName: "Demo Bistro",
    });

    expect(view.orders).toHaveLength(1);
    expect(view.orders[0]?.id).toBe("order-42");
    expect(view.orders[0]?.orderNumber).toBe(42);
    expect(view.orders[0]?.status).toBe("preparing");

    expect(view.transcript).toHaveLength(2);
    expect(view.transcript[0]?.role).toBe("guest");
    expect(view.transcript[0]?.text).toContain("Status");
    expect(view.transcript[1]?.role).toBe("denis");
    expect(view.transcript[1]?.text).toContain("#42");

    expect(view.chrome.headline).toContain("Craft IPA");
    expect(view.actions.some((action) => action.orderId === "order-42")).toBe(
      true
    );
  });
});
