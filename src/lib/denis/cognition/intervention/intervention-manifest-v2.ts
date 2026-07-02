import {
  DEFAULT_INTERVENTION_MANIFEST,
  INTERVENTION_MANIFEST_VERSION,
} from "@/lib/denis/cognition/intervention/intervention-manifest-defaults";
import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";

export const INTERVENTION_MANIFEST_V2_VERSION = "ijs-v2" as const;

/** Pilot manifest — scroll + tempo + sommelier rules on top of ijs-v1. */
export const INTERVENTION_MANIFEST_V2: InterventionManifest = {
  version: INTERVENTION_MANIFEST_V2_VERSION,
  rules: [
    ...DEFAULT_INTERVENTION_MANIFEST.rules,
    {
      id: "scroll_fast_search",
      when: {
        mental: {
          scrollSearching: true,
          predictedNeed: "needs_help_choosing",
        },
        trajectory: {
          ordering: "stuck",
          minOpportunity: 0.3,
          maxInterruptionRisk: 0.65,
        },
      },
      allow: {
        kinds: ["scroll_search", "browse_nudge"],
        riskClass: "R1",
      },
      defer: { debounceSec: 10, maxPerSession: 3 },
    },
    {
      id: "scroll_category_focus",
      when: {
        mental: {
          scrollDeferUpsell: true,
          intent: "exploring",
        },
        trajectory: {
          minOpportunity: 0.25,
          maxInterruptionRisk: 0.6,
        },
      },
      allow: {
        kinds: ["scroll_category"],
        riskClass: "R1",
      },
      defer: { debounceSec: 20, maxPerSession: 2 },
    },
    {
      id: "scroll_menu_bottom",
      when: {
        mental: {
          scrollReadyForRecommendation: true,
        },
        trajectory: {
          minOpportunity: 0.35,
          maxInterruptionRisk: 0.55,
        },
      },
      allow: {
        kinds: ["scroll_bottom", "scroll_search", "browse_nudge"],
        riskClass: "R1",
      },
    },
    {
      id: "tempo_browsing_stalled",
      when: {
        trajectory: {
          ordering: "stuck",
          engagement: "cold",
          minOpportunity: 0.35,
        },
        mental: {
          intent: "exploring",
        },
      },
      allow: {
        kinds: ["table_tempo_browse", "browse_nudge"],
        riskClass: "R1",
      },
    },
    {
      id: "tempo_drinks_refill",
      when: {
        trajectory: {
          meal: "active",
          minOpportunity: 0.4,
        },
        mental: {
          mealStage: "main",
        },
      },
      allow: {
        kinds: ["sommelier_refill", "drink_refill", "sommelier_pairing"],
        riskClass: "R1",
      },
    },
    {
      id: "tempo_post_meal",
      when: {
        trajectory: {
          meal: "post",
          ordering: "completing",
          minOpportunity: 0.3,
        },
        mental: {
          predictedNeed: "wants_bill",
        },
      },
      allow: {
        kinds: ["bill_prompt", "coffee_nudge", "digestif_nudge"],
        riskClass: "R1",
      },
    },
    {
      id: "lifecycle_eating_silence",
      when: {
        mental: {
          intent: "eating",
        },
      },
      allow: {
        kinds: [
          "order_delay",
          "order_eta_update",
          "slow_kitchen",
          "attention_handoff",
        ],
        riskClass: "R0",
      },
    },
    {
      id: "lifecycle_waiting_kitchen",
      when: {
        mental: {
          intent: "waiting_food",
        },
        trajectory: {
          meal: "active",
          minOpportunity: 0.25,
        },
      },
      allow: {
        kinds: [
          "order_eta_update",
          "order_preparing_notify",
          "slow_kitchen",
          "order_delay",
          "sommelier_refill",
          "drink_refill",
        ],
        riskClass: "R0",
      },
    },
    {
      id: "lifecycle_dessert_window",
      when: {
        mental: {
          mealStage: "dessert_window",
        },
        trajectory: {
          meal: "active",
          minOpportunity: 0.35,
        },
      },
      allow: {
        kinds: ["dessert_nudge", "coffee_nudge", "digestif_nudge"],
        riskClass: "R1",
      },
    },
  ],
};

/** Backward-compatible alias — v1 remains platform default. */
export const LEGACY_INTERVENTION_MANIFEST_VERSION = INTERVENTION_MANIFEST_VERSION;
