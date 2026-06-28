import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";

const disabledCapability = {
  enabled: false,
  rollout: { mode: "shadow" as const, canaryPercent: 10, tableSessionActorEnabled: false },
  params: {},
};

const canaryCapability = {
  enabled: true,
  rollout: { mode: "canary" as const, canaryPercent: 50, tableSessionActorEnabled: true },
  params: {},
};

const shadowCapability = {
  enabled: true,
  rollout: { mode: "shadow" as const, canaryPercent: 10, tableSessionActorEnabled: false },
  params: {},
};

/** CE-1 baseline — capabilities off; factual events still recorded. */
export const DEFAULT_COMMERCE_POLICY: CommercePolicy = {
  version: 1,
  capabilities: {
    "feedback.flow.v2": disabledCapability,
    "reorder.another_round": canaryCapability,
    "tips.smart_defaults": {
      ...canaryCapability,
      params: {
        venueAvgTipPercent: 15,
        tipSplitMode: "per_waiter",
        marketRegion: "de",
      },
    },
    "menu.personalization": disabledCapability,
    "menu.trending": disabledCapability,
    "kitchen.capacity_banner": canaryCapability,
    "preorder.scheduled": shadowCapability,
  },
  moments: {
    feedbackDelaySeconds: 600,
    feedbackRequiresBillSettled: false,
    googleReviewMinSentiment: "positive",
  },
};
