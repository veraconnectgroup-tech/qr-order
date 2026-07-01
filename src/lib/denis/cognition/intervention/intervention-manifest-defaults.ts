import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";

export const INTERVENTION_MANIFEST_VERSION = "ijs-v1" as const;

/** Canonical intervention manifest — IJS-P0: browse_stuck rule. */
export const DEFAULT_INTERVENTION_MANIFEST: InterventionManifest = {
  version: INTERVENTION_MANIFEST_VERSION,
  rules: [
    {
      id: "browse_stuck",
      when: {
        trajectory: {
          ordering: "stuck",
          minOpportunity: 0.35,
          maxInterruptionRisk: 0.55,
        },
        mental: {
          predictedNeed: "needs_help_choosing",
        },
        offer: {
          timingReady: true,
        },
      },
      allow: {
        kinds: ["browse_nudge", "popularity_pair", "cart_recovery"],
        riskClass: "R1",
      },
      defer: {
        debounceSec: 15,
        maxPerSession: 4,
      },
    },
    {
      id: "conversation_lull",
      when: {
        trajectory: {
          engagement: "lull",
          minOpportunity: 0.4,
          maxInterruptionRisk: 0.5,
        },
        mental: {
          intent: "exploring",
        },
      },
      allow: {
        kinds: ["browse_nudge", "browse_follow_up"],
        riskClass: "R1",
      },
    },
    {
      id: "end_of_meal",
      when: {
        trajectory: {
          meal: "post",
          ordering: "completing",
          minOpportunity: 0.35,
        },
        mental: {
          predictedNeed: "wants_bill",
        },
      },
      allow: {
        kinds: ["bill_prompt"],
        riskClass: "R1",
      },
    },
  ],
};
