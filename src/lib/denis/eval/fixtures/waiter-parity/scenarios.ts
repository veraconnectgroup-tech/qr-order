import type { WaiterParityScenario } from "@/lib/denis/eval/waiter-parity-types";
import {
  BEER_SERVE_OPTIONS,
  drinkLine,
} from "@/lib/denis/eval/fixtures/waiter-parity/helpers";

function pendingBeer(
  lastQuestion = "Koju veličinu piva — 0.3L ili 0.5L?"
) {
  return {
    flowNodeId: "collect" as const,
    aiCartItems: [drinkLine("p-pils", "Pils", null)],
    lastAssistantMessage: lastQuestion,
  };
}

const slotReplyBase = {
  planKind: "transactional_perceive" as const,
  requiresLlm: true,
  forbidPlanKinds: ["slot_extract" as const, "template_tell" as const],
  conversationMode: "ordering" as const,
  commercePendingSlot: "serve_size",
  conversationAwaiting: "serve_size" as const,
};

/** ADR-031 C3 — 40+ waiter-parity cognition journeys (no LLM, no DB). */
export const WAITER_PARITY_SCENARIOS: WaiterParityScenario[] = [
  // --- Slot / typo (12) ---
  {
    id: "wp_slot_typo_veliko_povo",
    description: "Typo veliko povo → transactional + fuzzy 0.5L",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "Veliko povo",
        expect: {
          ...slotReplyBase,
          fuzzyNormalized: "0.5L",
          situationIncludes: ["session.phase", "conversation.awaiting: serve_size"],
        },
        after: { applyServeSize: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_0_5",
    description: "Volume 0.5 → transactional perceive",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "0.5",
        expect: {
          ...slotReplyBase,
          fuzzyNormalized: "0.5L",
        },
        after: { applyServeSize: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_0_5_comma",
    description: "Volume 0,5 → fuzzy maps to preset",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "0,5",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_velika",
    description: "Size label velika",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "velika",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_malo",
    description: "Size label malo → smallest preset",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "malo molim",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
      },
    ],
  },
  {
    id: "wp_slot_veliko_pivo",
    description: "Phrase veliko pivo",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "Pa veliko pivo",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_german_gross",
    description: "DE gross → large preset",
    sessionLanguage: "de",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer("0,3L oder 0,5L?"),
    turns: [
      {
        message: "groß bitte",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_en_small",
    description: "EN small → 0.3L",
    sessionLanguage: "en",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer("Which size — 0.3L or 0.5L?"),
    turns: [
      {
        message: "small please",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
      },
    ],
  },
  {
    id: "wp_slot_never_extract",
    description: "Unknown slot reply never slot_extract",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "???",
        expect: {
          planKind: "transactional_perceive",
          forbidPlanKinds: ["slot_extract"],
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_slot_daj_05",
    description: "Phrase with embedded volume",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "daj 0,5 molim",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_srednja",
    description: "Medium label maps to middle preset",
    serveSizeOptions: ["0.25L", "0.33L", "0.5L"],
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "srednja",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.33L" },
      },
    ],
  },
  {
    id: "wp_slot_after_fill_no_pending",
    description: "After size applied, pending cleared on next turn",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "0.5",
        expect: slotReplyBase,
        after: { applyServeSize: "0.5L" },
      },
      {
        message: "hvala",
        expect: {
          conversationMode: "ordering",
          planKind: "transactional_perceive",
          requiresLlm: true,
          forbidPlanKinds: ["slot_extract"],
        },
      },
    ],
  },

  // --- Confirm / recap (8) ---
  {
    id: "wp_confirm_moze_recap",
    description: "Može at recap → T0 confirm",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "Može",
        expect: {
          planKind: "reflex_only",
          requiresLlm: false,
          usedT0: true,
        },
      },
    ],
  },
  {
    id: "wp_confirm_da_recap",
    description: "da at recap → T0",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "da",
        expect: { planKind: "reflex_only", usedT0: true, requiresLlm: false },
      },
    ],
  },
  {
    id: "wp_confirm_ajde_recap",
    description: "ajde at recap → T0",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-cola", "Cola", "0.5L")],
    },
    turns: [
      {
        message: "ajde",
        expect: { planKind: "reflex_only", usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_pošalji",
    description: "pošalji at recap → T0",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-mojito", "Mojito", null)],
    },
    turns: [
      {
        message: "da, pošalji",
        expect: { planKind: "reflex_only", usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_moze_not_t0_browse",
    description: "Može without recap is not T0 confirm",
    baseSetup: { flowNodeId: "browse" },
    turns: [
      {
        message: "Može",
        expect: {
          forbidPlanKinds: ["reflex_only"],
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_recap_add_more",
    description: "Recap + order more → transactional",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "još jedno pivo",
        expect: {
          planKind: "reflex_only",
          requiresLlm: false,
          usedT0: true,
          conversationMode: "ordering",
        },
      },
    ],
  },
  {
    id: "wp_confirm_de_ja",
    description: "DE ja at recap",
    sessionLanguage: "de",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "ja",
        expect: { planKind: "reflex_only", usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_en_yes",
    description: "EN yes at recap",
    sessionLanguage: "en",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "yes",
        expect: { planKind: "reflex_only", usedT0: true },
      },
    ],
  },

  // --- Ordering comprehend (10) ---
  {
    id: "wp_order_pivo",
    description: "Order pivo → transactional",
    turns: [
      {
        message: "pivo",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_order_daj_sok",
    description: "Daj mi sok with open cart belief",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-water", "Water", "0.5L")],
    },
    turns: [
      {
        message: "Daj mi sok",
        expect: {
          planKind: "transactional_perceive",
          conversationMode: "ordering",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_order_2x_cola",
    description: "Quantity order line",
    turns: [
      {
        message: "2x cola",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
      },
    ],
  },
  {
    id: "wp_order_de_zwei_bier",
    description: "DE order line",
    sessionLanguage: "de",
    turns: [
      {
        message: "zwei pils bitte",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
      },
    ],
  },
  {
    id: "wp_order_en_could_i",
    description: "EN polite order",
    sessionLanguage: "en",
    turns: [
      {
        message: "could I get a beer",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
      },
    ],
  },
  {
    id: "wp_vague_recommend",
    description: "Vague recommend → relational",
    turns: [
      {
        message: "preporuči mi nešto",
        expect: { planKind: "relational_perceive", requiresLlm: true },
      },
    ],
  },
  {
    id: "wp_banter_legendo_ordering",
    description: "Banter during open cart → transactional not template",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "gde si legendo",
        expect: {
          planKind: "transactional_perceive",
          conversationMode: "ordering",
          forbidPlanKinds: ["template_tell"],
        },
      },
    ],
  },
  {
    id: "wp_banter_zdravo_ordering",
    description: "Zdravo with cart → comprehend-first",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-cola", "Cola", "0.5L")],
    },
    turns: [
      {
        message: "Zdravo Denise",
        expect: {
          planKind: "transactional_perceive",
          conversationMode: "ordering",
        },
      },
    ],
  },
  {
    id: "wp_pure_social_greeting",
    description: "Pure social → relational",
    turns: [
      {
        message: "Zdravo kako si",
        expect: { planKind: "relational_perceive", requiresLlm: true },
      },
    ],
  },
  {
    id: "wp_hello_no_commerce",
    description: "Hello browse → relational pure social",
    baseSetup: { flowNodeId: "browse" },
    turns: [
      {
        message: "hello",
        expect: { planKind: "relational_perceive", requiresLlm: true },
      },
    ],
  },

  // --- Phase / settling / waiting (6) ---
  {
    id: "wp_settling_hvala",
    description: "Settling thanks → template not LLM banter",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "hvala, to je sve",
        expect: {
          planKind: "reflex_only",
          requiresLlm: false,
          usedT0: true,
          conversationMode: "ordering",
        },
      },
    ],
  },
  {
    id: "wp_settling_pay",
    description: "Pay request settling mode",
    turns: [
      {
        message: "možemo da platimo",
        expect: { planKind: "reflex_only", usedT0: true, requiresLlm: false },
      },
    ],
  },
  {
    id: "wp_waiting_status",
    description: "Waiting phase — status question transactional",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
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
    },
    turns: [
      {
        message: "gde je moje pivo",
        expect: {
          planKind: "transactional_perceive",
          situationIncludes: ["session.phase: waiting", "OPEN TABLE ORDERS"],
        },
      },
    ],
  },
  {
    id: "wp_situation_pack_transcript",
    description: "Situation pack includes transcript window",
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "0.5",
        expect: {
          ...slotReplyBase,
          situationIncludes: ["SITUATION PACK", "PHASE BEHAVIOR"],
        },
      },
    ],
  },
  {
    id: "wp_rush_no_upsell_plan",
    description: "Rush mode visible in situation pack on perceive",
    baseSetup: {
      operatingMode: "rush",
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "pivo",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
          situationIncludes: ["Operating mode: rush"],
        },
      },
    ],
  },
  {
    id: "wp_cart_conflict_goal",
    description: "Manual vs AI conflict surfaces reconcile goal",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-espresso", "Espresso", null)],
    },
    turns: [
      {
        message: "hello",
        setup: {
          aiCartItems: [drinkLine("p-espresso", "Espresso", null)],
        },
        expect: { planKind: "transactional_perceive" },
      },
    ],
  },

  // --- Multi-turn journeys (8) ---
  {
    id: "wp_journey_pivo_then_size",
    description: "Journey: order implied → slot answer",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    turns: [
      {
        message: "pivo",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
        after: {},
      },
      {
        message: "0.5",
        setup: pendingBeer(),
        expect: slotReplyBase,
        after: { applyServeSize: "0.5L" },
      },
    ],
  },
  {
    id: "wp_journey_typo_then_confirm",
    description: "Journey: typo slot → recap confirm",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    turns: [
      {
        message: "Veliko povo",
        setup: pendingBeer(),
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
        after: { applyServeSize: "0.5L" },
      },
      {
        message: "Može",
        setup: {
          flowNodeId: "recap",
          aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
        },
        expect: { planKind: "reflex_only", usedT0: true },
      },
    ],
  },
  {
    id: "wp_journey_add_then_recap",
    description: "Journey: add item → settling phrase",
    turns: [
      {
        message: "1x pils",
        expect: { planKind: "transactional_perceive" },
        after: {},
      },
      {
        message: "to je sve",
        setup: {
          flowNodeId: "recap",
          aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
        },
        expect: { conversationMode: "ordering", planKind: "reflex_only", usedT0: true },
      },
    ],
  },
  {
    id: "wp_journey_browse_recommend",
    description: "Journey: browse → recommend",
    turns: [
      {
        message: "šta imate od piva",
        setup: { flowNodeId: "browse" },
        expect: { planKind: "transactional_perceive" },
      },
      {
        message: "preporuči mi",
        expect: { planKind: "relational_perceive" },
      },
    ],
  },
  {
    id: "wp_journey_slot_de",
    description: "Journey: DE slot answer",
    sessionLanguage: "de",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    turns: [
      {
        message: "0,5L",
        setup: pendingBeer("0,3L oder 0,5L?"),
        expect: slotReplyBase,
      },
    ],
  },
  {
    id: "wp_journey_double_slot_attempt",
    description: "Journey: wrong then right slot answer",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    turns: [
      {
        message: "ne znam",
        setup: pendingBeer(),
        expect: {
          planKind: "transactional_perceive",
          forbidPlanKinds: ["slot_extract"],
        },
      },
      {
        message: "0.5",
        setup: pendingBeer(),
        expect: slotReplyBase,
        after: { applyServeSize: "0.5L" },
      },
    ],
  },
  {
    id: "wp_journey_merhaba_browse",
    description: "Journey: multilingual greeting browse",
    turns: [
      {
        message: "Merhaba",
        setup: { flowNodeId: "browse" },
        expect: { planKind: "relational_perceive", requiresLlm: true },
      },
    ],
  },
  {
    id: "wp_journey_que_tal",
    description: "Journey: Spanish greeting",
    turns: [
      {
        message: "Que tal",
        setup: { flowNodeId: "welcome" },
        expect: { planKind: "relational_perceive" },
      },
    ],
  },

  // --- Extra coverage to 40+ (4) ---
  {
    id: "wp_remove_reflex",
    description: "T0 remove from cart",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-cola", "Cola Zero", "0.5L")],
    },
    turns: [
      {
        message: "ukloni colu",
        expect: { planKind: "reflex_only", usedT0: true, requiresLlm: false },
      },
    ],
  },
  {
    id: "wp_ordering_belief_open_cart",
    description: "Open cart sticky ordering mode",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", null)],
    },
    turns: [
      {
        message: "hello",
        expect: {
          planKind: "transactional_perceive",
          conversationMode: "ordering",
          commercePendingSlot: "serve_size",
        },
      },
    ],
  },
  {
    id: "wp_confirm_pressure_recap",
    description: "Commerce confirm pressure at recap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [
        drinkLine("p-pils", "Pils", "0.5L"),
        drinkLine("p-cola", "Cola", "0.5L"),
      ],
    },
    turns: [
      {
        message: "da",
        expect: {
          planKind: "reflex_only",
          usedT0: true,
          conversationAwaiting: "confirm",
        },
      },
    ],
  },
  {
    id: "wp_slot_medium_three_options",
    description: "Three-option medium pick",
    serveSizeOptions: ["0.25L", "0.33L", "0.5L"],
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "medium",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.33L" },
      },
    ],
  },
];

export const WAITER_PARITY_MIN_SCENARIOS = 40;
export const WAITER_PARITY_MIN_PASS_RATE = 0.95;
