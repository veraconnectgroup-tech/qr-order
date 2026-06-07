import type { WaiterParityScenario } from "@/lib/denis/eval/waiter-parity-types";
import {
  BEER_SERVE_OPTIONS,
  drinkLine,
  foodLine,
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

/** ADR-030 — recap confirm uses LLM comprehend; T0 still flags CONFIRM/DONE for act. */
const confirmAtRecapExpect = {
  planKind: "transactional_perceive" as const,
  requiresLlm: true,
  conversationAwaiting: "confirm" as const,
} as const;

const waitingOrder = {
  id: "o1",
  orderNumber: 42,
  status: "preparing" as const,
  paymentStatus: "paid" as const,
  estimatedPrepMinutes: 8,
  createdAt: "2026-05-29T12:00:00.000Z",
  items: [{ productName: "Pils", quantity: 1 }],
};

/** ADR-033 PR-031-H.1 — 80+ waiter-parity cognition journeys (no LLM, no DB). */
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
    description: "Može at recap → comprehend confirm (ADR-030)",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "Može",
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_da_recap",
    description: "da at recap → comprehend confirm",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "da",
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_ajde_recap",
    description: "ajde at recap → comprehend confirm",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-cola", "Cola", "0.5L")],
    },
    turns: [
      {
        message: "ajde",
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_pošalji",
    description: "pošalji at recap → comprehend confirm",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-mojito", "Mojito", null)],
    },
    turns: [
      {
        message: "da, pošalji",
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_super_recap",
    description: "super at recap → comprehend confirm (ADR-030)",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "super",
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_confirm_tamam_recap",
    description: "tamam at recap → LLM comprehend (no T0 keyword)",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "tamam",
        expect: confirmAtRecapExpect,
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
        expect: { ...confirmAtRecapExpect, usedT0: true },
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
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },

  // --- Ordering comprehend (10) ---
  {
    id: "wp_order_veliko_pivo",
    description: "jedno veliko pivo → LLM comprehend (size implied, pick beer only)",
    baseSetup: { flowNodeId: "collect" },
    turns: [
      {
        message: "jedno veliko pivo",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
          conversationMode: "ordering",
        },
      },
    ],
  },
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
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
          conversationMode: "ordering",
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
        expect: { ...confirmAtRecapExpect, usedT0: true },
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
        expect: {
          conversationMode: "ordering",
          ...confirmAtRecapExpect,
          usedT0: true,
        },
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
          ...confirmAtRecapExpect,
          usedT0: true,
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
  {
    id: "wp_gap_blocks_confirm_drink",
    description: "Recap confirm blocked when generic pivo missing from cart",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage:
        "moze jedno pivo beef burger sa krompir salatom umesto pomfrita",
      lastAssistantMessage: "Da li je to sve?\nBeef Burger",
    },
    turns: [
      {
        message: "da",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
          conversationAwaiting: "confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_cleared_after_pilsner",
    description: "Drink added clears gap — recap confirm proceeds",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [
        foodLine("f-burger", "Beef Burger"),
        drinkLine("p-pils", "Pilsner", "0.5L"),
      ],
      lastGuestOrderMessage: "moze jedno pivo beef burger",
    },
    turns: [
      {
        message: "da",
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_gap_substitution_note",
    description: "Salata umesto pomfrita without note blocks confirm",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [
        foodLine("f-burger", "Beef Burger"),
        drinkLine("p-pils", "Pilsner", "0.5L"),
      ],
      lastGuestOrderMessage:
        "beef burger sa krompir salatom umesto pomfrita i pilsner",
    },
    turns: [
      {
        message: "da",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },

  // --- Gap confirm blocks (10) — ADR-033 H.1 ---
  {
    id: "wp_gap_blocks_moze",
    description: "Može at recap blocked by drink gap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "moze jedno pivo beef burger",
    },
    turns: [
      {
        message: "moze",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
          conversationAwaiting: "confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_ok",
    description: "ok at recap blocked by drink gap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "moze jedno pivo beef burger",
    },
    turns: [
      {
        message: "ok",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_ajde",
    description: "ajde at recap blocked by drink gap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "moze jedno pivo beef burger",
    },
    turns: [
      {
        message: "ajde",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_super",
    description: "super at recap blocked by drink gap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "moze jedno pivo beef burger",
    },
    turns: [
      {
        message: "super",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_posalji",
    description: "pošalji at recap blocked by drink gap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "moze jedno pivo beef burger",
    },
    turns: [
      {
        message: "pošalji",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_en_yes",
    description: "EN yes at recap blocked by drink gap",
    sessionLanguage: "en",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "one beer and beef burger please",
    },
    turns: [
      {
        message: "yes",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_en_send",
    description: "EN send it at recap blocked by drink gap",
    sessionLanguage: "en",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "one beer and beef burger",
    },
    turns: [
      {
        message: "send it",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_de_ja",
    description: "DE ja at recap blocked by drink gap",
    sessionLanguage: "de",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "ein bier und beef burger bitte",
    },
    turns: [
      {
        message: "ja",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_de_schick",
    description: "DE schick es at recap blocked by drink gap",
    sessionLanguage: "de",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "ein bier und beef burger",
    },
    turns: [
      {
        message: "schick es",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },
  {
    id: "wp_gap_blocks_burger_i_pivo",
    description: "burger i pivo transcript — drink unspecified at recap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [foodLine("f-burger", "Beef Burger")],
      lastGuestOrderMessage: "burger i pivo",
    },
    turns: [
      {
        message: "da",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },

  // --- Substitution (3) ---
  {
    id: "wp_sub_cleared_with_note",
    description: "Substitution note on line — recap confirm proceeds",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [
        {
          ...foodLine("f-burger", "Beef Burger"),
          notes: "Krompir salata umesto pomfrita",
        },
        drinkLine("p-pils", "Pilsner", "0.5L"),
      ],
      lastGuestOrderMessage:
        "beef burger sa krompir salatom umesto pomfrita i pilsner",
    },
    turns: [
      {
        message: "da",
        expect: confirmAtRecapExpect,
      },
    ],
  },
  {
    id: "wp_sub_moze_blocks",
    description: "Substitution gap — može blocked at recap",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [
        foodLine("f-burger", "Beef Burger"),
        drinkLine("p-pils", "Pilsner", "0.5L"),
      ],
      lastGuestOrderMessage: "burger sa salatom umesto pomfrita",
    },
    turns: [
      {
        message: "moze",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "waiter.gap_blocks_confirm",
        },
      },
    ],
  },

  // --- Extra slots DE/EN/SR (8) ---
  {
    id: "wp_slot_0_3",
    description: "Volume 0.3 → 0.3L preset",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "0.3",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
      },
    ],
  },
  {
    id: "wp_slot_0_3L",
    description: "Explicit 0.3L label",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "0.3L",
        expect: slotReplyBase,
      },
    ],
  },
  {
    id: "wp_slot_de_klein",
    description: "DE klein → 0.3L",
    sessionLanguage: "de",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer("0,3L oder 0,5L?"),
    turns: [
      {
        message: "klein",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
      },
    ],
  },
  {
    id: "wp_slot_de_klein_bitte",
    description: "DE klein bitte → 0.3L",
    sessionLanguage: "de",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer("0,3L oder 0,5L?"),
    turns: [
      {
        message: "klein bitte",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
      },
    ],
  },
  {
    id: "wp_slot_en_large",
    description: "EN large → 0.5L",
    sessionLanguage: "en",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer("Which size — 0.3L or 0.5L?"),
    turns: [
      {
        message: "large",
        expect: { ...slotReplyBase, fuzzyNormalized: "0.5L" },
      },
    ],
  },
  {
    id: "wp_slot_en_pint",
    description: "EN pint — transactional slot reply",
    sessionLanguage: "en",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer("Which size?"),
    turns: [
      {
        message: "pint",
        expect: slotReplyBase,
      },
    ],
  },
  {
    id: "wp_slot_pol_litra",
    description: "SR pol litra — pending slot transactional",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    baseSetup: pendingBeer(),
    turns: [
      {
        message: "pol litra",
        expect: {
          ...slotReplyBase,
          commercePendingSlot: "serve_size",
        },
      },
    ],
  },

  // --- Waiting status (7) ---
  {
    id: "wp_waiting_en_where_beer",
    description: "EN waiting — where is my beer",
    sessionLanguage: "en",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "where is my beer",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
          conversationMode: "ordering",
        },
      },
    ],
  },
  {
    id: "wp_waiting_de_wo_bier",
    description: "DE waiting — wo ist mein bier",
    sessionLanguage: "de",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "wo ist mein bier",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },
  {
    id: "wp_waiting_de_wo_bestellung",
    description: "DE waiting — wo ist meine bestellung",
    sessionLanguage: "de",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "wo ist meine bestellung",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },
  {
    id: "wp_waiting_sr_gde_narudzbina",
    description: "SR waiting — gde je moja narudžbina",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "gde je moja narudžbina",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },
  {
    id: "wp_waiting_sr_gde_narudzba",
    description: "SR waiting — gde je narudžba",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "gde je narudžba",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },
  {
    id: "wp_waiting_sr_kad_stize",
    description: "SR waiting — kad stiže",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "kad stiže",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },
  {
    id: "wp_waiting_sr_moje_pivo",
    description: "SR waiting — moje pivo",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "moje pivo",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },
  {
    id: "wp_waiting_en_order_status",
    description: "EN waiting — order status",
    sessionLanguage: "en",
    sessionPhase: "waiting",
    baseSetup: {
      flowNodeId: "post_submit",
      orders: [waitingOrder],
    },
    turns: [
      {
        message: "order status",
        expect: {
          planKind: "template_tell",
          requiresLlm: false,
          reason: "commerce.status.open_order",
        },
      },
    ],
  },

  // --- Rush mode (4) ---
  {
    id: "wp_rush_settling",
    description: "Rush mode — to je sve settling reflex",
    baseSetup: {
      operatingMode: "rush",
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "to je sve",
        expect: {
          planKind: "reflex_only",
          usedT0: true,
          requiresLlm: false,
        },
      },
    ],
  },
  {
    id: "wp_rush_browse_order",
    description: "Rush browse — order still transactional",
    baseSetup: {
      operatingMode: "rush",
      flowNodeId: "browse",
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
    id: "wp_rush_browse_recommend",
    description: "Rush browse — recommend relational with rush pack",
    baseSetup: {
      operatingMode: "rush",
      flowNodeId: "browse",
    },
    turns: [
      {
        message: "šta preporučujete",
        expect: {
          planKind: "relational_perceive",
          requiresLlm: true,
          situationIncludes: ["Operating mode: rush"],
        },
      },
    ],
  },
  {
    id: "wp_rush_remove_reflex",
    description: "Rush mode — T0 remove still works",
    baseSetup: {
      operatingMode: "rush",
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-cola", "Cola", "0.5L")],
    },
    turns: [
      {
        message: "ukloni colu",
        expect: {
          planKind: "reflex_only",
          usedT0: true,
          requiresLlm: false,
        },
      },
    ],
  },
  {
    id: "wp_rush_banter_hvala",
    description: "Rush with open cart — hvala stays transactional",
    baseSetup: {
      operatingMode: "rush",
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "hvala",
        expect: {
          planKind: "transactional_perceive",
          conversationMode: "ordering",
        },
      },
    ],
  },

  // --- Confirm decline / multilingual social (8) ---
  {
    id: "wp_confirm_ne_recap",
    description: "ne at recap → comprehend (not confirm)",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "ne",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_confirm_en_nope",
    description: "EN nope at recap → comprehend",
    sessionLanguage: "en",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "nope",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_confirm_nema_sanse",
    description: "nema šanse at recap → comprehend decline",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "nema šanse",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_confirm_bice",
    description: "biće at recap → comprehend confirm",
    baseSetup: {
      flowNodeId: "recap",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "biće",
        expect: confirmAtRecapExpect,
      },
    ],
  },
  {
    id: "wp_vague_de_empfehlen",
    description: "DE was empfehlen sie → relational",
    sessionLanguage: "de",
    turns: [
      {
        message: "was empfehlen sie",
        expect: {
          planKind: "relational_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_vague_en_recommend",
    description: "EN what do you recommend → relational",
    sessionLanguage: "en",
    turns: [
      {
        message: "what do you recommend",
        expect: {
          planKind: "relational_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_social_de_guten_tag",
    description: "DE guten tag browse → relational",
    sessionLanguage: "de",
    baseSetup: { flowNodeId: "browse" },
    turns: [
      {
        message: "guten tag",
        expect: {
          planKind: "relational_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_social_sr_dobro_vece",
    description: "SR dobro veče welcome → relational",
    baseSetup: { flowNodeId: "welcome" },
    turns: [
      {
        message: "dobro veče",
        expect: {
          planKind: "relational_perceive",
          requiresLlm: true,
        },
      },
    ],
  },

  // --- Extra ordering / remove (5) ---
  {
    id: "wp_order_hladno_pivo",
    description: "hladno pivo → transactional",
    turns: [
      {
        message: "hladno pivo",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_order_jedno_pivo",
    description: "jedno pivo → transactional",
    turns: [
      {
        message: "jedno pivo",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_order_mogu_li_pivo",
    description: "mogu li da naručim pivo → transactional ordering",
    turns: [
      {
        message: "mogu li da naručim pivo",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
          conversationMode: "ordering",
        },
      },
    ],
  },
  {
    id: "wp_order_pils_i_burger",
    description: "pils i burger combo → transactional",
    turns: [
      {
        message: "pils i burger",
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
    ],
  },
  {
    id: "wp_remove_pivo",
    description: "T0 remove pivo from cart",
    baseSetup: {
      flowNodeId: "collect",
      aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
    },
    turns: [
      {
        message: "ukloni pivo",
        expect: {
          planKind: "reflex_only",
          usedT0: true,
          requiresLlm: false,
        },
      },
    ],
  },

  // --- Multi-turn journeys (5) ---
  {
    id: "wp_journey_pivo_03_confirm",
    description: "Journey: pivo → 0.3L → može confirm",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    turns: [
      {
        message: "pivo",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
      },
      {
        message: "0.3",
        setup: pendingBeer(),
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
        after: { applyServeSize: "0.3L" },
      },
      {
        message: "može",
        setup: {
          flowNodeId: "recap",
          aiCartItems: [drinkLine("p-pils", "Pils", "0.3L")],
        },
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_journey_gap_then_drink",
    description: "Journey: gap blocks → add pilsner → comprehend confirm",
    turns: [
      {
        message: "da",
        setup: {
          flowNodeId: "recap",
          aiCartItems: [foodLine("f-burger", "Beef Burger")],
          lastGuestOrderMessage: "moze jedno pivo beef burger",
        },
        expect: {
          planKind: "template_tell",
          reason: "waiter.gap_blocks_confirm",
        },
      },
      {
        message: "pilsner",
        setup: {
          flowNodeId: "collect",
          aiCartItems: [
            foodLine("f-burger", "Beef Burger"),
            drinkLine("p-pils", "Pilsner", "0.5L"),
          ],
          lastGuestOrderMessage: "moze jedno pivo beef burger",
        },
        expect: {
          planKind: "transactional_perceive",
          requiresLlm: true,
        },
      },
      {
        message: "da",
        setup: {
          flowNodeId: "recap",
          aiCartItems: [
            foodLine("f-burger", "Beef Burger"),
            drinkLine("p-pils", "Pilsner", "0.5L"),
          ],
          lastGuestOrderMessage: "moze jedno pivo beef burger",
        },
        expect: confirmAtRecapExpect,
      },
    ],
  },
  {
    id: "wp_journey_de_order_confirm",
    description: "Journey: DE order → ja confirm",
    sessionLanguage: "de",
    turns: [
      {
        message: "ein pils",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
      },
      {
        message: "ja",
        setup: {
          flowNodeId: "recap",
          aiCartItems: [drinkLine("p-pils", "Pils", "0.5L")],
        },
        expect: { ...confirmAtRecapExpect, usedT0: true },
      },
    ],
  },
  {
    id: "wp_journey_en_beer_small",
    description: "Journey: EN beer → small slot",
    sessionLanguage: "en",
    serveSizeOptions: BEER_SERVE_OPTIONS,
    turns: [
      {
        message: "beer",
        expect: { planKind: "transactional_perceive", requiresLlm: true },
      },
      {
        message: "small",
        setup: {
          flowNodeId: "collect",
          aiCartItems: [drinkLine("p-pils", "Pils", null)],
          lastAssistantMessage: "Which size — 0.3L or 0.5L?",
        },
        expect: { ...slotReplyBase, fuzzyNormalized: "0.3L" },
      },
    ],
  },
];

export const WAITER_PARITY_MIN_SCENARIOS = 80;
export const WAITER_PARITY_MIN_PASS_RATE = 0.95;
