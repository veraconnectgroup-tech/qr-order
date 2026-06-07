import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  drinkLine,
  foodLine,
} from "@/lib/denis/eval/fixtures/waiter-parity/helpers";
import { timelineRow } from "@/lib/denis/eval/fixtures/timeline/helpers";

export type ContinuousMindExpect = {
  gapCount: number;
  primaryGap?: string | null;
  canConfirm?: boolean;
  foldMatchesWatcher?: boolean;
  foldMatchesTurn?: boolean;
  foldMatchesWorld?: boolean;
};

export type ContinuousMindScenario = {
  id: string;
  description: string;
  timeline: DenisTimelineRow[];
  cartLines: DenisCartLine[];
  flowNodeId: "recap" | "collect" | "browse";
  guestMessage?: string;
  expect: ContinuousMindExpect;
};

const TRACE_ORDER = "trace-cm-order";
const TRACE_CONFIRM = "trace-cm-confirm";
const TRACE_WORLD = "trace-cm-world";

function orderTimeline(guestText: string): DenisTimelineRow[] {
  return [
    timelineRow({
      seq: 1,
      traceId: TRACE_ORDER,
      eventType: "perception.ingested",
      payload: {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: guestText,
          structuredIntent: null,
          ingestedAt: "2026-06-07T12:00:01.000Z",
        },
        envelope: { traceId: TRACE_ORDER, surface: "chat" },
      },
    }),
    timelineRow({
      seq: 2,
      traceId: TRACE_ORDER,
      eventType: "tell.committed",
      payload: {
        type: "tell.committed",
        message: "Beef Burger — da li je to sve?",
        tier: "template",
        source: "chat",
      },
    }),
    timelineRow({
      seq: 3,
      traceId: TRACE_ORDER,
      eventType: "flow.transitioned",
      payload: { from: "collect", to: "recap", signal: "cart.recap" },
    }),
  ];
}

function confirmTimeline(guestText: string): DenisTimelineRow[] {
  return [
    timelineRow({
      seq: 4,
      traceId: TRACE_CONFIRM,
      eventType: "perception.ingested",
      payload: {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: guestText,
          structuredIntent: null,
          ingestedAt: "2026-06-07T12:00:10.000Z",
        },
        envelope: { traceId: TRACE_CONFIRM, surface: "chat" },
      },
    }),
  ];
}

function worldReadyTimeline(message: string): DenisTimelineRow[] {
  return [
    timelineRow({
      seq: 5,
      traceId: TRACE_WORLD,
      eventType: "world.ingested",
      payload: {
        type: "world.ingested",
        signal: "commerce.order_status",
        status: "ready",
        orderNumber: 17,
      },
    }),
    timelineRow({
      seq: 6,
      traceId: TRACE_WORLD,
      eventType: "tell.committed",
      payload: {
        type: "tell.committed",
        message,
        tier: "template",
        source: "world.commerce",
        linted: true,
      },
    }),
  ];
}

/** ARCH-6 — fold / watcher / turn / world must agree on one obligation state. */
export const CONTINUOUS_MIND_SCENARIOS: ContinuousMindScenario[] = [
  {
    id: "cm_gap_fold_watcher_turn",
    description: "Drink gap — fold, watcher, and turn paths agree",
    timeline: orderTimeline("moze jedno pivo beef burger"),
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    expect: {
      gapCount: 1,
      primaryGap: "drink_unspecified",
      canConfirm: false,
      foldMatchesWatcher: true,
      foldMatchesTurn: true,
      foldMatchesWorld: true,
    },
  },
  {
    id: "cm_gap_turn_da_recap",
    description: "Guest da at recap — turn merge keeps drink gap",
    timeline: [
      ...orderTimeline("moze jedno pivo beef burger"),
      ...confirmTimeline("da"),
    ],
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 1,
      primaryGap: "drink_unspecified",
      canConfirm: false,
      foldMatchesWatcher: true,
      foldMatchesTurn: true,
    },
  },
  {
    id: "cm_cleared_cart_confirm",
    description: "Full cart — all sources allow confirm",
    timeline: [
      ...orderTimeline("pilsner i beef burger"),
      ...confirmTimeline("da"),
    ],
    cartLines: [
      drinkLine("p-pils", "Pilsner", "0.5L"),
      foodLine("f-burger", "Beef Burger"),
    ],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 0,
      canConfirm: true,
      foldMatchesWatcher: true,
      foldMatchesTurn: true,
      foldMatchesWorld: true,
    },
  },
  {
    id: "cm_world_tell_preserves_gap",
    description: "World ready tell does not clear cart obligation gap",
    timeline: [
      ...orderTimeline("moze jedno pivo beef burger"),
      ...worldReadyTimeline("Narudžbina #17 je spremna — preuzmite na šanku."),
    ],
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    expect: {
      gapCount: 1,
      primaryGap: "drink_unspecified",
      canConfirm: false,
      foldMatchesWorld: true,
    },
  },
];
