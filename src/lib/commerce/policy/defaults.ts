import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";

const disabledCapability = {
  enabled: false,
  rollout: { mode: "shadow" as const, canaryPercent: 10, tableSessionActorEnabled: false },
  params: {},
};

/** CE-1 baseline — capabilities off; factual events still recorded. */
export const DEFAULT_COMMERCE_POLICY: CommercePolicy = {
  version: 1,
  capabilities: {
    "feedback.flow.v2": disabledCapability,
    "reorder.another_round": disabledCapability,
    "tips.smart_defaults": disabledCapability,
    "menu.personalization": disabledCapability,
    "menu.trending": disabledCapability,
    "kitchen.capacity_banner": disabledCapability,
    "preorder.scheduled": disabledCapability,
  },
  moments: {
    feedbackDelaySeconds: 600,
    feedbackRequiresBillSettled: false,
    googleReviewMinSentiment: "positive",
  },
};
