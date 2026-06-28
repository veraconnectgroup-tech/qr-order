import type { AnticipationScenario } from "@/lib/denis/eval/anticipation-types";
import {
  browseRow,
  guestMessageRow,
} from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { drinkLine } from "@/lib/denis/eval/fixtures/waiter-parity/helpers";

const NOW = Date.parse("2026-05-29T20:00:00.000Z");

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

/** Prompt 35 — additional anticipation scenarios (40+ corpus). */
export const ANTICIPATION_PROMPT35_SCENARIOS: AnticipationScenario[] = [
  {
    id: "anticipation-dessert-viewed-3x",
    description: "Guest viewed desserts 3 times → dessert browse nudge",
    setup: {
      sessionPhase: "browsing",
      timeline: [
        browseRow(1, {
          action: "view_product",
          productId: "d-tiramisu",
          productName: "Tiramisu",
          categoryId: "cat-desserts",
          categoryPath: ["desserts", "cakes"],
          menuSection: "desserts",
          dwellMs: 2_500,
          timestamp: isoSecondsAgo(45),
        }),
        browseRow(2, {
          action: "view_product",
          productId: "d-cheesecake",
          productName: "Cheesecake",
          categoryId: "cat-desserts",
          categoryPath: ["desserts", "cakes"],
          menuSection: "desserts",
          dwellMs: 2_000,
          timestamp: isoSecondsAgo(30),
        }),
        browseRow(3, {
          action: "view_product",
          productId: "d-tiramisu",
          productName: "Tiramisu",
          categoryId: "cat-desserts",
          categoryPath: ["desserts", "tiramisu"],
          menuSection: "desserts",
          dwellMs: 3_500,
          timestamp: isoSecondsAgo(12),
        }),
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "browse_nudge",
      planKind: "template_tell",
      requiresLlm: false,
      messageIncludes: "desert",
    },
  },
  {
    id: "anticipation-wait-20min-kitchen-status",
    description: "Guest waiting 20 min → slow kitchen empathy nudge",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-wait-20",
          orderNumber: 31,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 10,
          prepEstimateConfidence: "high",
          createdAt: isoMinutesAgo(20),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "slow_kitchen",
      planKind: "template_tell",
      requiresLlm: false,
      messageIncludes: "Kuhinja",
    },
  },
  {
    id: "anticipation-order-ready-food",
    description: "Kitchen marks food ready → order_ready_notify",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-ready-food",
          orderNumber: 32,
          status: "ready",
          paymentStatus: "paid",
          estimatedPrepMinutes: 12,
          createdAt: isoMinutesAgo(14),
          items: [{ productName: "Schnitzel", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "order_ready_notify",
      planKind: "template_tell",
      requiresLlm: false,
    },
  },
  {
    id: "anticipation-pairing-after-schnitzel",
    description: "Recent food order → drink pairing nudge",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-pair-de",
          orderNumber: 33,
          status: "accepted",
          paymentStatus: "paid",
          estimatedPrepMinutes: 15,
          createdAt: isoMinutesAgo(2),
          items: [{ productName: "Wiener Schnitzel", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "drink_pairing",
      planKind: "template_tell",
      requiresLlm: false,
    },
  },
  {
    id: "anticipation-bill-en-post-meal",
    description: "Post-meal EN guest → bill prompt",
    setup: {
      sessionPhase: "settling",
      mentalModelMode: "enforce",
      dessertEnabled: false,
      orders: [
        {
          id: "ord-bill-en",
          orderNumber: 34,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(55),
          items: [{ productName: "Steak", quantity: 1 }],
        },
      ],
      timeline: [guestMessageRow(1, "check please", isoMinutesAgo(1))],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "bill_prompt",
      planKind: "template_tell",
      requiresLlm: false,
    },
  },
  {
    id: "anticipation-rush-skips-browse",
    description: "Rush mode suppresses browse nudge",
    setup: {
      sessionPhase: "browsing",
      operatingMode: "rush",
      skipUpsell: true,
    },
    payload: { browseMinutes: 8 },
    expect: { emit: false, skipReason: "venue.upsell_suppressed" },
  },
  {
    id: "anticipation-cart-abandonment-pressure",
    description: "Open cart blocks browse proactive",
    setup: {
      sessionPhase: "ordering",
      aiCartItems: [drinkLine("p-wine", "House Wine", null, 2)],
    },
    payload: { browseMinutes: 12 },
    expect: { emit: false, skipReason: "commerce.active" },
  },
  {
    id: "anticipation-latent-no-nudge",
    description: "Latent phase stays silent without posture signal",
    setup: {
      sessionPhase: "latent",
      mentalModelMode: "enforce",
      timeline: [],
    },
    payload: { browseMinutes: 6 },
    expect: { emit: false, skipReason: "gmm.confidence_insufficient" },
  },
  {
    id: "anticipation-popularity-pair-idle",
    description: "Idle browse with popularity pair candidate",
    setup: {
      sessionPhase: "browsing",
      mentalModelMode: "shadow",
      timeline: [
        browseRow(1, {
          action: "view_category",
          categoryId: "cat-drinks",
          categoryPath: ["drinks"],
          menuSection: "drinks",
          dwellMs: 5_000,
          timestamp: isoSecondsAgo(20),
        }),
      ],
    },
    payload: {
      browseMinutes: 6,
      popularityPair: { from: "Pilsner", to: "Craft IPA" },
    },
    expect: { emit: true, kind: "popularity_pair", planKind: "template_tell" },
  },
  {
    id: "anticipation-slow-kitchen-mild-12min",
    description: "12 min wait still below slow kitchen threshold",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-mild-wait",
          orderNumber: 35,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 18,
          createdAt: isoMinutesAgo(12),
          items: [{ productName: "Pasta", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "no_candidate" },
  },
];

export const ANTICIPATION_PROMPT35_COUNT = ANTICIPATION_PROMPT35_SCENARIOS.length;
