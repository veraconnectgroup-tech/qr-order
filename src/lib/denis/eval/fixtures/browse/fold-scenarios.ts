import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type BrowseFoldScenario = {
  id: string;
  description: string;
  timeline: DenisTimelineRow[];
  expect: {
    eventCount: number;
    browsedFood?: boolean;
    browsedDrinks?: boolean;
    topProductName?: string;
    cartAbandonedCount?: number;
    totalBrowseMs?: number;
  };
};

const AI = "00000000-0000-4000-8000-000000000099";

function browseRow(seq: number, event: BrowseEvent): DenisTimelineRow {
  return {
    id: `browse-${seq}`,
    ai_session_id: AI,
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      frame: {
        channel: "telemetry.browse",
        normalizedText: String(event.productName ?? event.categoryPath ?? ""),
        structuredIntent: "BROWSE",
        ingestedAt: String(event.timestamp),
      },
      envelope: { traceId: `trace-${seq}`, surface: "sense" },
      browseEvent: event,
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: `2026-06-07T12:00:0${seq}.000Z`,
  };
}

export const BROWSE_FOLD_SCENARIOS: BrowseFoldScenario[] = [
  {
    id: "bf_food_product_dwell",
    description: "view_product on burger builds food browse profile",
    timeline: [
      browseRow(1, {
        action: "view_product",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Beef Burger",
        categoryId: "cat-burgers",
        categoryPath: ["food", "burgers"],
        menuSection: "food",
        dwellMs: 8200,
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
    ],
    expect: {
      eventCount: 1,
      browsedFood: true,
      topProductName: "Beef Burger",
      totalBrowseMs: 8200,
    },
  },
  {
    id: "bf_cart_abandoned",
    description: "add then remove marks cartAbandoned",
    timeline: [
      browseRow(1, {
        action: "add_to_cart",
        productId: "22222222-2222-4222-8222-222222222222",
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:00:01.000Z",
      }),
      browseRow(2, {
        action: "remove_from_cart",
        productId: "22222222-2222-4222-8222-222222222222",
        productName: "Pilsner",
        categoryPath: ["drinks", "beer"],
        menuSection: "drinks",
        timestamp: "2026-06-07T12:00:02.000Z",
      }),
    ],
    expect: {
      eventCount: 2,
      browsedDrinks: true,
      cartAbandonedCount: 1,
    },
  },
  {
    id: "bf_ignores_chat",
    description: "chat messages do not affect browse fold",
    timeline: [
      {
        id: "chat-1",
        ai_session_id: AI,
        seq: 1,
        event_type: "signal.message",
        payload: {
          type: "signal.message",
          text: "moze burger",
          channel: "chat.message",
        },
        trace_id: "trace-chat",
        context_hash: null,
        created_at: "2026-06-07T12:00:00.000Z",
      },
      browseRow(2, {
        action: "view_category",
        categoryId: "cat-food",
        categoryPath: ["food"],
        menuSection: "food",
        dwellMs: 1200,
        timestamp: "2026-06-07T12:00:03.000Z",
      }),
    ],
    expect: {
      eventCount: 1,
      browsedFood: true,
      totalBrowseMs: 1200,
    },
  },
];
