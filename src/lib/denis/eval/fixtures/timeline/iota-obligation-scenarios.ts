import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  drinkLine,
  foodLine,
} from "@/lib/denis/eval/fixtures/waiter-parity/helpers";
import { timelineRow } from "@/lib/denis/eval/fixtures/timeline/helpers";

export type TimelineObligationExpect = {
  gapCount?: number;
  primaryGap?: string | null;
  canConfirm?: boolean;
  planKind?: string;
  planReason?: string;
  autonomousTell?: boolean;
};

export type TimelineObligationScenario = {
  id: string;
  description: string;
  timeline: DenisTimelineRow[];
  cartLines: DenisCartLine[];
  flowNodeId: "recap" | "collect" | "browse";
  guestMessage?: string;
  expect: TimelineObligationExpect;
};

const TRACE_ORDER = "trace-order-1";
const TRACE_CONFIRM = "trace-confirm-1";

function iotaOrderTimeline(guestText: string): DenisTimelineRow[] {
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
          ingestedAt: "2026-05-29T12:00:01.000Z",
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

function iotaConfirmTimeline(guestText: string): DenisTimelineRow[] {
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
          ingestedAt: "2026-05-29T12:00:10.000Z",
        },
        envelope: { traceId: TRACE_CONFIRM, surface: "chat" },
      },
    }),
  ];
}

/** ADR-032 / P1-T7 / ADR-033 PR-031-H.2 — anonymized iota-style timeline obligation replay (no DB). */
export const IOTA_TIMELINE_OBLIGATION_SCENARIOS: TimelineObligationScenario[] = [
  {
    id: "tl_iota_gap_drink_recap",
    description: "Timeline transcript → drink gap persists at recap",
    timeline: iotaOrderTimeline("moze jedno pivo beef burger"),
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    expect: {
      gapCount: 1,
      primaryGap: "drink_unspecified",
      canConfirm: false,
    },
  },
  {
    id: "tl_iota_gap_blocks_confirm_da",
    description: "Replay da at recap → waiter.gap_blocks_confirm",
    timeline: [
      ...iotaOrderTimeline("moze jedno pivo beef burger"),
      ...iotaConfirmTimeline("da"),
    ],
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 1,
      planKind: "template_tell",
      planReason: "waiter.gap_blocks_confirm",
    },
  },
  {
    id: "tl_iota_gap_cleared_pilsner",
    description: "Pilsner in cart clears drink gap — confirm allowed",
    timeline: [
      ...iotaOrderTimeline("moze jedno pivo beef burger"),
      timelineRow({
        seq: 4,
        traceId: "trace-drink-1",
        eventType: "draft.changed",
        payload: {
          type: "draft.changed",
          cartRevision: 2,
          guestMessage: "pilsner",
        },
      }),
      ...iotaConfirmTimeline("da"),
    ],
    cartLines: [
      foodLine("f-burger", "Beef Burger"),
      drinkLine("p-pils", "Pilsner", "0.5L"),
    ],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 0,
      canConfirm: true,
      planKind: "transactional_perceive",
    },
  },
  {
    id: "tl_iota_substitution_gap",
    description: "Salata umesto pomfrita without kitchen note → substitution gap",
    timeline: iotaOrderTimeline(
      "beef burger sa krompir salatom umesto pomfrita i pilsner"
    ),
    cartLines: [
      foodLine("f-burger", "Beef Burger"),
      drinkLine("p-pils", "Pilsner", "0.5L"),
    ],
    flowNodeId: "recap",
    expect: {
      gapCount: 1,
      primaryGap: "substitution_note",
      canConfirm: false,
    },
  },
  {
    id: "tl_iota_autonomous_tell",
    description: "Gap state triggers autonomous waiter_gap tell",
    timeline: iotaOrderTimeline("moze jedno pivo beef burger"),
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    expect: {
      gapCount: 1,
      autonomousTell: true,
    },
  },
  {
    id: "tl_iota_transcript_fold",
    description: "Timeline fold preserves order line for obligation",
    timeline: iotaOrderTimeline("moze jedno pivo beef burger"),
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "collect",
    expect: {
      gapCount: 1,
      primaryGap: "drink_unspecified",
    },
  },
  {
    id: "tl_iota_complete_cart_confirm",
    description: "Full cart at recap — no gap, comprehend confirm",
    timeline: [
      ...iotaOrderTimeline("pilsner i beef burger"),
      ...iotaConfirmTimeline("moze"),
    ],
    cartLines: [
      drinkLine("p-pils", "Pilsner", "0.5L"),
      foodLine("f-burger", "Beef Burger"),
    ],
    flowNodeId: "recap",
    guestMessage: "moze",
    expect: {
      gapCount: 0,
      canConfirm: true,
      planKind: "transactional_perceive",
    },
  },
  {
    id: "tl_iota_gap_blocks_confirm_substitution",
    description: "Replay da at recap → substitution gap blocks confirm",
    timeline: [
      ...iotaOrderTimeline(
        "beef burger sa krompir salatom umesto pomfrita i pilsner"
      ),
      ...iotaConfirmTimeline("da"),
    ],
    cartLines: [
      foodLine("f-burger", "Beef Burger"),
      drinkLine("p-pils", "Pilsner", "0.5L"),
    ],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 1,
      primaryGap: "substitution_note",
      planKind: "template_tell",
      planReason: "waiter.gap_blocks_confirm",
    },
  },
  {
    id: "tl_iota_substitution_cleared_with_note",
    description: "Kitchen note on cart line clears substitution gap",
    timeline: [
      ...iotaOrderTimeline(
        "beef burger sa krompir salatom umesto pomfrita i pilsner"
      ),
      ...iotaConfirmTimeline("da"),
    ],
    cartLines: [
      {
        ...foodLine("f-burger", "Beef Burger"),
        notes: "Zamena: krompir salata umesto pomfrita",
      },
      drinkLine("p-pils", "Pilsner", "0.5L"),
    ],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 0,
      canConfirm: true,
      planKind: "transactional_perceive",
    },
  },
  {
    id: "tl_iota_food_only_no_gap",
    description: "Typed food order without generic pivo — no drink gap",
    timeline: iotaOrderTimeline("beef burger molim"),
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    expect: {
      gapCount: 0,
      canConfirm: true,
    },
  },
  {
    id: "tl_iota_gap_blocks_confirm_moze",
    description: "Replay moze at recap with drink gap → waiter.gap_blocks_confirm",
    timeline: [
      ...iotaOrderTimeline("moze jedno pivo beef burger"),
      ...iotaConfirmTimeline("moze"),
    ],
    cartLines: [foodLine("f-burger", "Beef Burger")],
    flowNodeId: "recap",
    guestMessage: "moze",
    expect: {
      gapCount: 1,
      primaryGap: "drink_unspecified",
      planKind: "template_tell",
      planReason: "waiter.gap_blocks_confirm",
    },
  },
  {
    id: "tl_iota_drink_only_confirm",
    description: "Typed pilsner only — recap confirm proceeds",
    timeline: [
      ...iotaOrderTimeline("pivo pilsner molim"),
      ...iotaConfirmTimeline("da"),
    ],
    cartLines: [drinkLine("p-pils", "Pilsner", "0.5L")],
    flowNodeId: "recap",
    guestMessage: "da",
    expect: {
      gapCount: 0,
      canConfirm: true,
      planKind: "transactional_perceive",
    },
  },
  {
    id: "tl_iota_autonomous_tell_substitution",
    description: "Substitution gap triggers autonomous waiter_gap tell",
    timeline: iotaOrderTimeline(
      "beef burger sa krompir salatom umesto pomfrita i pilsner"
    ),
    cartLines: [
      foodLine("f-burger", "Beef Burger"),
      drinkLine("p-pils", "Pilsner", "0.5L"),
    ],
    flowNodeId: "recap",
    expect: {
      gapCount: 1,
      primaryGap: "substitution_note",
      autonomousTell: true,
    },
  },
];
