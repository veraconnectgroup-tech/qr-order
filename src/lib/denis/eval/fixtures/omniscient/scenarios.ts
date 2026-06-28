import type { OmniscientScenario } from "@/lib/denis/eval/omniscient-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { CONTEXTUAL_CHIP_IDS } from "@/lib/denis/loop/derive-contextual-chips";
import {
  isoMinutesAgo,
  isoSecondsAgo,
  OMNISCIENT_EVAL_NOW,
} from "@/lib/denis/eval/fixtures/omniscient/helpers";

const FRIDAY_RUSH_ISO = "2026-06-05T18:00:00.000Z";
const SUNDAY_BRUNCH_ISO = "2026-06-07T09:00:00.000Z";

const FRIDAY_RHYTHM_PRIORS = {
  version: 1 as const,
  slots: {
    "1:10": {
      sampleSessions: 8,
      sessionDurationP50Min: 35,
      dessertDelayP50Min: 14,
      revenueEma: 150,
      servicePeriod: "breakfast" as const,
      topProducts: [],
    },
    "2:12": {
      sampleSessions: 10,
      sessionDurationP50Min: 40,
      dessertDelayP50Min: 15,
      revenueEma: 200,
      servicePeriod: "lunch" as const,
      topProducts: [],
    },
    "5:20": {
      sampleSessions: 45,
      sessionDurationP50Min: 52,
      dessertDelayP50Min: 18,
      revenueEma: 420,
      servicePeriod: "dinner" as const,
      topProducts: [{ productId: "p1", name: "Burger", count: 38 }],
    },
  },
  prepTime: {
    version: 1 as const,
    byProduct: {},
    byStation: {
      kitchen: { p50: 16, p90: 24, samples: 120, rushMultiplier: 1.375 },
      bar: { p50: 3, p90: 6, samples: 80, rushMultiplier: 1.2 },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
};

const SUNDAY_RHYTHM_PRIORS = {
  version: 1 as const,
  slots: {
    "1:10": {
      sampleSessions: 8,
      sessionDurationP50Min: 35,
      dessertDelayP50Min: 14,
      revenueEma: 150,
      servicePeriod: "breakfast" as const,
      topProducts: [],
    },
    "2:12": {
      sampleSessions: 10,
      sessionDurationP50Min: 40,
      dessertDelayP50Min: 15,
      revenueEma: 200,
      servicePeriod: "lunch" as const,
      topProducts: [],
    },
    "0:11": {
      sampleSessions: 14,
      sessionDurationP50Min: 38,
      dessertDelayP50Min: 12,
      revenueEma: 180,
      servicePeriod: "lunch" as const,
      topProducts: [{ productId: "p2", name: "Aperol", count: 15 }],
    },
  },
  prepTime: {
    version: 1 as const,
    byProduct: {},
    byStation: {
      kitchen: { p50: 16, p90: 24, samples: 120, rushMultiplier: 1.375 },
      bar: { p50: 3, p90: 6, samples: 80, rushMultiplier: 1.2 },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
};

const RHYTHM_PRIORS = FRIDAY_RHYTHM_PRIORS;

const PREP_PRIORS_HIGH = {
  version: 1 as const,
  byProduct: {
    "burger-id": {
      productId: "burger-id",
      p50Minutes: 14,
      p90Minutes: 20,
      sampleCount: 47,
      rushMultiplier: 1.35,
    },
  },
  byStation: {
    kitchen: { p50: 16, p90: 24, samples: 120, rushMultiplier: 1.375 },
    bar: { p50: 3, p90: 6, samples: 80, rushMultiplier: 1.2 },
  },
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const PREP_PRIORS_EMPTY = {
  version: 1 as const,
  byProduct: {},
  byStation: {},
  updatedAt: "2026-06-01T00:00:00.000Z",
};

export const OMNISCIENT_MIN_SCENARIOS = 20;
export const OMNISCIENT_MIN_PASS_RATE = 1;

/** E1 — omniscient Denis: kitchen, bar, ETA, rhythm, proactive, dock, floor. */
export const OMNISCIENT_SCENARIOS: OmniscientScenario[] = [
  // --- KITCHEN AWARENESS ---
  {
    id: "kitchen_delay_empathy",
    description: "Order 20 min, ETA 12 — slow kitchen fires with empathy",
    category: "kitchen",
    check: {
      type: "slow_kitchen",
      orders: [
        {
          id: "ord-delay",
          status: "preparing",
          created_at: isoMinutesAgo(20),
          estimated_prep_minutes: 12,
          prep_estimate_confidence: "high",
          menu_section: "food",
          product_name: "Burger",
        },
      ],
      expectFires: true,
      expectDrinkOffer: true,
      messageIncludes: ["strpljenj", "kuhinja"],
    },
  },
  {
    id: "kitchen_ready_instant",
    description: "Order ready → push + persist tell",
    category: "kitchen",
    check: {
      type: "world_tell",
      status: "ready",
      items: [{ productName: "Burger", quantity: 1 }],
      locale: "sr",
      expectPush: true,
      expectPersistTell: true,
      messageIncludes: ["spremn"],
    },
  },
  {
    id: "kitchen_preparing_silent",
    description: "Preparing updates headline only — no push",
    category: "kitchen",
    check: {
      type: "world_tell",
      status: "preparing",
      items: [{ productName: "Burger", quantity: 1 }],
      locale: "sr",
      expectPush: false,
      expectPersistTell: false,
      messageIncludes: ["priprema"],
    },
  },
  {
    id: "kitchen_station_stress_high",
    description: "4 kitchen orders ~12 min → kitchen stress high",
    category: "kitchen",
    check: {
      type: "station_queues",
      orders: [
        {
          status: "preparing",
          created_at: isoMinutesAgo(12),
          accepted_at: isoMinutesAgo(11),
          preparing_at: isoMinutesAgo(10),
          order_items: [{ menu_section: "food" }],
        },
        {
          status: "preparing",
          created_at: isoMinutesAgo(11),
          accepted_at: isoMinutesAgo(10),
          preparing_at: isoMinutesAgo(9),
          order_items: [{ menu_section: "food" }],
        },
        {
          status: "preparing",
          created_at: isoMinutesAgo(10),
          accepted_at: isoMinutesAgo(9),
          preparing_at: isoMinutesAgo(8),
          order_items: [{ menu_section: "food" }],
        },
        {
          status: "accepted",
          created_at: isoMinutesAgo(8),
          accepted_at: isoMinutesAgo(7),
          preparing_at: null,
          order_items: [{ menu_section: "food" }],
        },
      ],
      expect: { kitchenCount: 4, kitchenAvgMin: 9 },
    },
  },
  {
    id: "guest_has_drink_no_double",
    description: "Kitchen delay with active drink — no drink offer",
    category: "kitchen",
    check: {
      type: "slow_kitchen",
      orders: [
        {
          id: "ord-food",
          status: "preparing",
          created_at: isoMinutesAgo(20),
          estimated_prep_minutes: 12,
          prep_estimate_confidence: "high",
          menu_section: "food",
          product_name: "Burger",
        },
        {
          id: "ord-drink",
          status: "accepted",
          created_at: isoMinutesAgo(2),
          estimated_prep_minutes: 3,
          menu_section: "drinks",
          product_name: "Pils",
        },
      ],
      expectFires: true,
      expectDrinkOffer: false,
      messageForbidden: ["popijete", "piće dok"],
    },
  },

  // --- BAR vs KITCHEN ---
  {
    id: "bar_vs_kitchen_eta",
    description: "Mixed order — separate kitchen and bar station ETAs",
    category: "bar",
    check: {
      type: "commerce_lifecycle",
      orders: [
        {
          id: "o-bar",
          orderNumber: 1,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 3,
          createdAt: isoMinutesAgo(3),
          items: [{ productName: "Pivo", quantity: 1, menuSection: "drinks" }],
        },
        {
          id: "o-kitchen",
          orderNumber: 2,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 14,
          createdAt: isoMinutesAgo(10),
          items: [{ productName: "Burger", quantity: 1, menuSection: "food" }],
        },
      ],
      venueOps: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [
          {
            station: "bar",
            stress: "normal",
            activeCount: 1,
            avgWaitMinutes: 3,
          },
          {
            station: "kitchen",
            stress: "high",
            activeCount: 1,
            avgWaitMinutes: 14,
          },
        ],
      },
      expectKitchenEta: 14,
      expectBarEta: 3,
    },
  },
  {
    id: "bar_queue_fast",
    description: "Bar-only queue ~3 min avg",
    category: "bar",
    check: {
      type: "station_queues",
      orders: [
        {
          status: "preparing",
          created_at: isoMinutesAgo(3),
          accepted_at: isoMinutesAgo(2),
          preparing_at: isoMinutesAgo(2),
          order_items: [{ menu_section: "drinks" }],
        },
        {
          status: "accepted",
          created_at: isoMinutesAgo(2),
          accepted_at: isoMinutesAgo(1),
          preparing_at: null,
          order_items: [{ menu_section: "drinks" }],
        },
      ],
      expect: { barCount: 2, barAvgMin: 2, kitchenCount: 0 },
    },
  },
  {
    id: "bar_only_no_kitchen_backlog",
    description: "Drinks-only orders do not inflate kitchen queue",
    category: "bar",
    check: {
      type: "station_queues",
      orders: [
        {
          status: "preparing",
          created_at: isoMinutesAgo(5),
          accepted_at: isoMinutesAgo(4),
          preparing_at: isoMinutesAgo(3),
          order_items: [{ menu_section: "drinks" }],
        },
      ],
      expect: { kitchenCount: 0, barCount: 1 },
    },
  },

  // --- HONEST ETA ---
  {
    id: "eta_high_confidence",
    description: "47 samples → ~14 min high confidence",
    category: "eta",
    check: {
      type: "prep_estimate",
      priors: PREP_PRIORS_HIGH,
      items: [{ productId: "burger-id", station: "kitchen" }],
      expectMinutes: 14,
      expectConfidence: "high",
    },
  },
  {
    id: "eta_no_data",
    description: "No priors → no minute estimate",
    category: "eta",
    check: {
      type: "prep_estimate",
      priors: PREP_PRIORS_EMPTY,
      items: [{ productId: "new-item", station: "kitchen" }],
      expectMinutes: null,
      expectConfidence: "none",
    },
  },
  {
    id: "eta_low_confidence_station",
    description: "Unknown product falls back to station prior (low confidence)",
    category: "eta",
    check: {
      type: "prep_estimate",
      priors: PREP_PRIORS_HIGH,
      items: [{ productId: "unknown-id", station: "bar" }],
      expectMinutes: 3,
      expectConfidence: "low",
    },
  },
  {
    id: "eta_commerce_evidence_high",
    description: "Commerce evidence shows specific ETA when confidence high",
    category: "eta",
    check: {
      type: "commerce_evidence",
      orders: [
        {
          id: "o1",
          orderNumber: 5,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 14,
          prepEstimateConfidence: "high",
          createdAt: isoMinutesAgo(5),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
      includes: ["preparing", "on track"],
    },
  },
  {
    id: "eta_commerce_evidence_none",
    description: "Commerce evidence vague when no ETA data",
    category: "eta",
    check: {
      type: "commerce_evidence",
      orders: [
        {
          id: "o1",
          orderNumber: 5,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(5),
          items: [{ productName: "Special", quantity: 1 }],
        },
      ],
      includes: ["ETA: preparing"],
      excludes: ["~"],
    },
  },

  // --- RHYTHM ---
  {
    id: "friday_rush_no_upsell",
    description: "Friday 20h busy slot → high stress + skip upsell in rush mode",
    category: "rhythm",
    check: {
      type: "rhythm",
      priors: FRIDAY_RHYTHM_PRIORS,
      nowIso: FRIDAY_RUSH_ISO,
      expectSlotStress: "rush",
      expectSkipUpsell: true,
    },
  },
  {
    id: "sunday_brunch_relax",
    description: "Sunday 11h brunch slot → moderate stress, pairing allowed",
    category: "rhythm",
    check: {
      type: "rhythm",
      priors: SUNDAY_RHYTHM_PRIORS,
      nowIso: SUNDAY_BRUNCH_ISO,
      expectSlotStress: "busy",
      expectSkipUpsell: false,
    },
  },
  {
    id: "rhythm_brunch_pairing_proactive",
    description: "Sunday brunch + recent food → drink pairing proactive",
    category: "proactive",
    check: {
      type: "proactive",
      setup: {
        sessionPhase: "waiting",
        operatingMode: "normal",
        orders: [
          {
            id: "ord-pair",
            orderNumber: 2,
            status: "accepted",
            paymentStatus: "paid",
            estimatedPrepMinutes: 12,
            createdAt: isoSecondsAgo(45),
            items: [{ productName: "Schnitzel", quantity: 1 }],
          },
        ],
      },
      payload: {},
      expect: {
        emit: true,
        kind: "drink_pairing",
        requiresLlm: false,
      },
    },
  },

  // --- PROACTIVE ---
  {
    id: "all_delivered_dessert_window",
    description: "Main delivered 15 min ago → dessert nudge",
    category: "proactive",
    check: {
      type: "proactive",
      setup: {
        sessionPhase: "settling",
        orders: [
          {
            id: "ord-main",
            orderNumber: 1,
            status: "delivered",
            paymentStatus: "paid",
            estimatedPrepMinutes: null,
            createdAt: isoMinutesAgo(40),
            items: [{ productName: "Burger", quantity: 1 }],
          },
        ],
      },
      payload: {},
      expect: {
        emit: true,
        kind: "dessert_nudge",
        requiresLlm: false,
      },
    },
  },
  {
    id: "slow_kitchen_proactive_emit",
    description: "Slow kitchen proactive rank emits template tell",
    category: "proactive",
    check: {
      type: "proactive",
      setup: {
        sessionPhase: "waiting",
        slowKitchenEnabled: true,
        orders: [
          {
            id: "ord-slow",
            orderNumber: 9,
            status: "preparing",
            paymentStatus: "paid",
            estimatedPrepMinutes: 12,
            prepEstimateConfidence: "high",
            createdAt: isoMinutesAgo(18),
            items: [{ productName: "Pizza", quantity: 1 }],
          },
        ],
      },
      payload: {},
      expect: {
        emit: true,
        kind: "slow_kitchen",
        planKind: "template_tell",
        requiresLlm: false,
      },
    },
  },
  {
    id: "pairing_blocked_in_rush",
    description: "Pairing suppressed when venue is in rush mode",
    category: "proactive",
    check: {
      type: "proactive",
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
      expect: {
        emit: false,
        skipReason: "venue.upsell_suppressed",
      },
    },
  },

  // --- VIEW-FIRST DOCK ---
  {
    id: "dock_browsing_idle",
    description: "No orders → browse headline + recommend chips",
    category: "dock",
    check: {
      type: "dock",
      phase: "browsing",
      headlineIncludes: ["Pregledajte meni"],
      urgency: "idle",
      chipActions: [CONTEXTUAL_CHIP_IDS.recommend, "situation-waiter"],
    },
  },
  {
    id: "dock_preparing_eta",
    description: "Preparing order → dock shows items and ETA",
    category: "dock",
    check: {
      type: "dock",
      phase: "waiting",
      orders: [
        {
          id: "o1",
          orderNumber: 7,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 8,
          createdAt: isoMinutesAgo(4),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
      headlineIncludes: ["Burger", "~8 min"],
      urgency: "active",
    },
  },
  {
    id: "dock_ready_alert",
    description: "Ready order → dock alert urgency + spremni headline",
    category: "dock",
    check: {
      type: "dock",
      phase: "waiting",
      orders: [
        {
          id: "o1",
          orderNumber: 7,
          status: "ready",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(15),
          items: [{ productName: "Pivo", quantity: 2 }],
        },
      ],
      headlineIncludes: ["spremn", "Pivo"],
      urgency: "alert",
    },
  },
  {
    id: "dock_late_empathy",
    description: "Late kitchen → dock patience headline",
    category: "dock",
    check: {
      type: "dock",
      phase: "waiting",
      orders: [
        {
          id: "o1",
          orderNumber: 7,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 10,
          createdAt: isoMinutesAgo(25),
          items: [{ productName: "Pizza", quantity: 1 }],
        },
      ],
      headlineIncludes: ["strpljenju"],
      urgency: "alert",
    },
  },
  {
    id: "dock_mixed_ready_subline",
    description: "Bar ready + kitchen preparing → subline for ready items",
    category: "dock",
    check: {
      type: "dock",
      phase: "waiting",
      orders: [
        {
          id: "o-bar",
          orderNumber: 1,
          status: "ready",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: isoMinutesAgo(8),
          items: [{ productName: "Pivo", quantity: 1 }],
        },
        {
          id: "o-kitchen",
          orderNumber: 2,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 14,
          createdAt: isoMinutesAgo(10),
          items: [{ productName: "Burger", quantity: 1 }],
        },
      ],
      headlineIncludes: ["Burger", "~14"],
      sublineIncludes: ["Pivo", "pickup"],
    },
  },

  // --- FLOOR / STAFF ---
  {
    id: "understaffed_house_hint",
    description: "1 staff + 7 active orders → understaffed hint",
    category: "floor",
    check: {
      type: "floor",
      staffOnFloor: 1,
      activeOrderCount: 7,
      expectHouseHint: "Floor appears understaffed.",
    },
  },
  {
    id: "understaffed_auto_rush",
    description: "Thin floor + 10 orders → auto rush threshold",
    category: "floor",
    check: {
      type: "floor",
      staffOnFloor: 1,
      activeOrderCount: 10,
      kdsBacklogMinutes: null,
      expectHouseHint: "Floor appears understaffed.",
      expectAutoRush: true,
    },
  },
  {
    id: "staff_on_floor_evidence",
    description: "Venue ops evidence shows staff count",
    category: "floor",
    check: {
      type: "venue_ops_evidence",
      venueOps: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [],
        staffOnFloor: 2,
        houseHint: null,
      },
      includes: ["Staff on floor: 2"],
    },
  },
];

export const OMNISCIENT_SCENARIO_COUNT = OMNISCIENT_SCENARIOS.length;
