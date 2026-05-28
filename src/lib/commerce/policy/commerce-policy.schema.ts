import type { ConciergeRollout } from "@/lib/denis/config/rollout";

export type CommerceCapabilityId =
  | "feedback.flow.v2"
  | "reorder.another_round"
  | "tips.smart_defaults"
  | "menu.personalization"
  | "menu.trending"
  | "kitchen.capacity_banner"
  | "preorder.scheduled";

export type CommerceCapabilityConfig = {
  enabled: boolean;
  rollout: ConciergeRollout;
  experimentKey?: string;
  params: Record<string, unknown>;
};

export type CommercePolicy = {
  version: number;
  capabilities: Record<CommerceCapabilityId, CommerceCapabilityConfig>;
  moments: {
    feedbackDelaySeconds: number;
    feedbackRequiresBillSettled: boolean;
    googleReviewMinSentiment: "positive";
  };
};

export type ActiveCapabilities = CommerceCapabilityId[];
