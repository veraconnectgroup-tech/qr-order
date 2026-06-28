import type { AnticipationScenario } from "@/lib/denis/eval/anticipation-types";
import { browseRow, guestMessageRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { drinkLine } from "@/lib/denis/eval/fixtures/waiter-parity/helpers";
import { ANTICIPATION_PROMPT35_SCENARIOS } from "@/lib/denis/eval/fixtures/anticipation/prompt35-scenarios";

const NOW = Date.parse("2026-05-29T20:00:00.000Z");

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

export const ANTICIPATION_EVAL_NOW = NOW;

export const ANTICIPATION_SCENARIOS: AnticipationScenario[] = [
  {
    id: "browse-idle-5min",
    description: "Browse nudge after 5 minutes with no orders",
    setup: { sessionPhase: "browsing" },
    payload: { browseMinutes: 5 },
    expect: { emit: true, kind: "browse_nudge", planKind: "template_tell", requiresLlm: false },
  },
  {
    id: "browse-too-soon",
    description: "No browse nudge before threshold",
    setup: { sessionPhase: "browsing" },
    payload: { browseMinutes: 1 },
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "browse-dismissed",
    description: "Dismissed browse nudge stays silent",
    setup: { sessionPhase: "browsing", dismissedNudges: ["browse_nudge"] },
    payload: { browseMinutes: 8 },
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "browse-waiting-phase",
    description: "Browse blocked while waiting for kitchen",
    setup: { sessionPhase: "waiting" },
    payload: { browseMinutes: 10 },
    expect: { emit: false, skipReason: "phase.browse_blocked" },
  },
  {
    id: "browse-has-orders",
    description: "Browse suppressed when session already ordered",
    setup: {
      sessionPhase: "browsing",
      orders: [
        {
          id: "ord-1",
          orderNumber: 1,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(40),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
    },
    payload: { browseMinutes: 6 },
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "pairing-recent-food",
    description: "Drink pairing after recent food order",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-pair",
          orderNumber: 2,
          status: "accepted",
          paymentStatus: "paid",
          estimatedPrepMinutes: 12,
          createdAt: isoMinutesAgo(1),
          items: [{ productName: "Schnitzel", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "drink_pairing",
      planKind: "template_tell",
      requiresLlm: false,
      messageIncludes: "Getränk",
    },
  },
  {
    id: "pairing-rush-blocked",
    description: "Pairing suppressed in rush mode",
    setup: {
      sessionPhase: "waiting",
      operatingMode: "rush",
      orders: [
        {
          id: "ord-rush",
          orderNumber: 3,
          status: "pending",
          paymentStatus: "paid",
          estimatedPrepMinutes: 15,
          createdAt: isoMinutesAgo(1),
          items: [{ productName: "Pizza", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "venue.upsell_suppressed", kind: "sommelier_pairing" },
  },
  {
    id: "pairing-skip-upsell",
    description: "Pairing suppressed when venue.skip_upsell",
    setup: {
      sessionPhase: "waiting",
      skipUpsell: true,
      orders: [
        {
          id: "ord-skip",
          orderNumber: 4,
          status: "accepted",
          paymentStatus: "paid",
          estimatedPrepMinutes: 10,
          createdAt: isoMinutesAgo(1),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "venue.upsell_suppressed", kind: "sommelier_pairing" },
  },
  {
    id: "pairing-dismissed",
    description: "Dismissed pairing stays silent",
    setup: {
      sessionPhase: "waiting",
      dismissedNudges: ["sommelier_pairing:ord-dismiss"],
      orders: [
        {
          id: "ord-dismiss",
          orderNumber: 5,
          status: "accepted",
          paymentStatus: "paid",
          estimatedPrepMinutes: 10,
          createdAt: isoMinutesAgo(1),
          items: [{ productName: "Pasta", quantity: 1 }],
        },
      ],
    },
    payload: { dismissedNudgeKeys: ["sommelier_pairing:ord-dismiss"] },
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "dessert-settling-window",
    description: "Dessert nudge in settling after main delivered",
    setup: {
      sessionPhase: "settling",
      orders: [
        {
          id: "ord-dessert",
          orderNumber: 6,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(25),
          items: [{ productName: "Steak", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "dessert_nudge",
      planKind: "template_tell",
      requiresLlm: false,
      messageIncludes: "desert",
    },
  },
  {
    id: "dessert-waiting-blocked",
    description: "No dessert nudge while kitchen still open",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-open",
          orderNumber: 7,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 8,
          createdAt: isoMinutesAgo(10),
          items: [{ productName: "Burger", quantity: 1 }],
        },
        {
          id: "ord-delivered",
          orderNumber: 8,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(22),
          items: [{ productName: "Salad", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "phase.dessert_blocked", kind: "dessert_nudge" },
  },
  {
    id: "dessert-already-ordered",
    description: "No dessert when desserts already on tab",
    setup: {
      sessionPhase: "settling",
      orders: [
        {
          id: "ord-has-dessert",
          orderNumber: 9,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(22),
          items: [{ productName: "Tiramisu", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "slow-kitchen-wait",
    description: "Slow kitchen empathy nudge after long wait",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-slow",
          orderNumber: 10,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 12,
          prepEstimateConfidence: "high",
          createdAt: isoMinutesAgo(18),
          items: [{ productName: "Ribs", quantity: 1 }],
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
    id: "slow-kitchen-dismissed",
    description: "Dismissed slow kitchen stays silent",
    setup: {
      sessionPhase: "waiting",
      dismissedNudges: ["slow_kitchen:ord-slow2"],
      orders: [
        {
          id: "ord-slow2",
          orderNumber: 11,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 20,
          createdAt: isoMinutesAgo(20),
          items: [{ productName: "Steak", quantity: 1 }],
        },
      ],
    },
    payload: { dismissedNudgeKeys: ["slow_kitchen:ord-slow2"] },
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "commerce-pending-slot",
    description: "Proactive blocked while awaiting serve_size",
    setup: {
      sessionPhase: "ordering",
      pendingSlot: "serve_size",
      aiCartItems: [drinkLine("p-cola", "Cola", null)],
    },
    payload: { browseMinutes: 10 },
    expect: { emit: false, skipReason: "commerce.active" },
  },
  {
    id: "commerce-open-cart",
    description: "Proactive blocked with open cart pressure",
    setup: {
      sessionPhase: "ordering",
      aiCartItems: [drinkLine("p-beer", "Pils", "0.5L")],
    },
    payload: { browseMinutes: 10 },
    expect: { emit: false, skipReason: "commerce.active" },
  },
  {
    id: "proactive-disabled",
    description: "Global proactive off → silent",
    setup: { sessionPhase: "browsing", proactiveEnabled: false },
    payload: { browseMinutes: 10 },
    expect: { emit: false, skipReason: "proactive.disabled", kind: "browse_nudge" },
  },
  {
    id: "settling-pairing-blocked",
    description: "Upsell pairing blocked in settling (dessert-only)",
    setup: {
      sessionPhase: "settling",
      orders: [
        {
          id: "ord-settle-pair",
          orderNumber: 12,
          status: "accepted",
          paymentStatus: "paid",
          estimatedPrepMinutes: 5,
          createdAt: isoMinutesAgo(1),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "session.settling", kind: "sommelier_pairing" },
  },
  {
    id: "session-closed",
    description: "Closed session never nudges",
    setup: { sessionPhase: "closed" },
    payload: { browseMinutes: 10 },
    expect: { emit: false, skipReason: "session.closed" },
  },
  {
    id: "latent-browse",
    description: "Latent phase allows browse nudge",
    setup: { sessionPhase: "latent" },
    payload: { browseMinutes: 4 },
    expect: { emit: true, kind: "browse_nudge", planKind: "template_tell" },
  },
  {
    id: "pairing-has-drink-in-cart",
    description: "Pairing skipped when drink already in cart",
    setup: {
      sessionPhase: "waiting",
      orders: [
        {
          id: "ord-drink-cart",
          orderNumber: 13,
          status: "accepted",
          paymentStatus: "paid",
          estimatedPrepMinutes: 10,
          createdAt: isoMinutesAgo(1),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
    },
    payload: { hasDrinkInCart: true },
    expect: { emit: false, skipReason: "no_candidate" },
  },
  {
    id: "dessert-disabled-flag",
    description: "Venue dessert flag off blocks dessert",
    setup: {
      sessionPhase: "settling",
      dessertEnabled: false,
      orders: [
        {
          id: "ord-no-dessert-flag",
          orderNumber: 14,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(22),
          items: [{ productName: "Pasta", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: { emit: false, skipReason: "proactive.dessert_disabled", kind: "dessert_nudge" },
  },
  {
    id: "slow-kitchen-disabled-flag",
    description:
      "Venue slow-kitchen flag off blocks empathy nudge but order_eta_update still fires",
    setup: {
      sessionPhase: "waiting",
      slowKitchenEnabled: false,
      orders: [
        {
          id: "ord-no-slow",
          orderNumber: 15,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 12,
          prepEstimateConfidence: "high",
          createdAt: isoMinutesAgo(18),
          items: [{ productName: "Fish", quantity: 1 }],
        },
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "order_eta_update",
      planKind: "template_tell",
      requiresLlm: false,
    },
  },
  {
    id: "gmm-closed-blocks-browse",
    description: "Closed guest gets no browse candidate under mental-first (enforce)",
    setup: {
      sessionPhase: "browsing",
      dismissedNudges: ["browse_nudge", "popularity_pair"],
      mentalModelMode: "enforce",
      timeline: [
        guestMessageRow(1, "ne hvala", isoMinutesAgo(1)),
        browseRow(2, {
          action: "view_product",
          productId: "p1",
          productName: "Burger",
          categoryPath: ["food"],
          menuSection: "food",
          dwellMs: 3000,
          timestamp: isoMinutesAgo(2),
        }),
      ],
    },
    payload: { browseMinutes: 10, dismissedNudgeKeys: [] },
    expect: {
      emit: false,
      skipReason: "no_candidate",
    },
  },
  {
    id: "gmm-mental-browse-ok",
    description: "Mental-first browse nudge without browseMinutes (enforce)",
    setup: {
      sessionPhase: "browsing",
      mentalModelMode: "enforce",
      timeline: [
        browseRow(1, {
          action: "view_product",
          productId: "p1",
          productName: "Burger",
          categoryPath: ["food", "burgers"],
          menuSection: "food",
          dwellMs: 4000,
          timestamp: isoMinutesAgo(4),
        }),
        browseRow(2, {
          action: "view_product",
          productId: "p2",
          productName: "Pasta",
          categoryPath: ["food", "pasta"],
          menuSection: "food",
          dwellMs: 3500,
          timestamp: isoMinutesAgo(3),
        }),
        browseRow(3, {
          action: "view_product",
          productId: "p3",
          productName: "Salad",
          categoryPath: ["food", "salads"],
          menuSection: "food",
          dwellMs: 2800,
          timestamp: isoMinutesAgo(2),
        }),
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "browse_nudge",
      planKind: "template_tell",
      requiresLlm: false,
    },
  },
  {
    id: "gmm-mental-ignore-minutes",
    description: "Enforce mode ignores browseMinutes when posture not ready",
    setup: {
      sessionPhase: "latent",
      mentalModelMode: "enforce",
      timeline: [],
    },
    payload: { browseMinutes: 10 },
    expect: { emit: false, skipReason: "gmm.confidence_insufficient", kind: "bill_prompt" },
  },
  {
    id: "gmm-mental-bill-post-meal",
    description: "Mental-first bill prompt from post_meal posture (enforce)",
    setup: {
      sessionPhase: "settling",
      mentalModelMode: "enforce",
      dessertEnabled: false,
      orders: [
        {
          id: "ord-bill",
          orderNumber: 20,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(45),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
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
    id: "gmm-attention-handoff",
    description: "Frustrated guest posture → attention handoff (enforce)",
    setup: {
      sessionPhase: "waiting",
      mentalModelMode: "enforce",
      timeline: [
        guestMessageRow(1, "ČEKAM???", isoMinutesAgo(3)),
        guestMessageRow(2, "gde je hrana", isoMinutesAgo(2)),
        guestMessageRow(3, "gde je hrana", isoMinutesAgo(1)),
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "attention_handoff",
      planKind: "template_tell",
      requiresLlm: false,
      messageIncludes: "konobar",
    },
  },
  {
    id: "gmm-rank-bill-over-dessert",
    description: "post_meal wants_bill ranks bill above dessert (enforce)",
    setup: {
      sessionPhase: "settling",
      mentalModelMode: "enforce",
      dessertEnabled: true,
      orders: [
        {
          id: "ord-rank-bill",
          orderNumber: 21,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(50),
          items: [{ productName: "Steak", quantity: 1 }],
        },
      ],
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
    id: "offer-enrich-beef-burger-personalized",
    description: "Offer enrich replaces generic browse nudge with product name",
    setup: {
      sessionPhase: "browsing",
      mentalModelMode: "enforce",
      offerEnrich: true,
      timeline: [
        browseRow(1, {
          action: "view_product",
          productId: "11111111-1111-4111-8111-111111111111",
          productName: "Beef Burger",
          categoryId: "cat-burgers",
          categoryPath: ["food", "burgers"],
          menuSection: "food",
          dwellMs: 35_000,
          timestamp: isoSecondsAgo(10),
        }),
      ],
    },
    payload: {},
    expect: {
      emit: true,
      kind: "browse_nudge",
      planKind: "template_tell",
      requiresLlm: false,
      messageIncludes: "Beef Burger",
      messageForbidden: "Treba vam pomoć",
    },
  },
  {
    id: "offer-enrich-blocks-without-telemetry",
    description: "Offer enrich drops browse nudge when no resolved offer",
    setup: {
      sessionPhase: "browsing",
      mentalModelMode: "enforce",
      offerEnrich: true,
      timeline: [],
    },
    payload: { browseMinutes: 10 },
    expect: {
      emit: false,
      skipReason: "gmm.confidence_insufficient",
      kind: "bill_prompt",
    },
  },
  ...ANTICIPATION_PROMPT35_SCENARIOS,
];

export const ANTICIPATION_MIN_SCENARIOS = 40;
export const ANTICIPATION_MIN_PASS_RATE = 0.95;
