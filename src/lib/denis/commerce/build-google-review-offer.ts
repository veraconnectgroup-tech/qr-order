import { buildReviewFunnelOffer } from "@/lib/denis/commerce/build-review-funnel-offer";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { GoogleReviewOffer } from "@/lib/denis/loop/view-types";
import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";
import type { SessionPhase } from "@/lib/scene/types";

/** Build Denis Google review sheet offer after payment + experience score (Q1). */
export function buildGoogleReviewOffer(input: {
  state: TableSessionState;
  phase: SessionPhase;
  googleReviewUrl: string | null;
  language?: string;
  policy?: CommercePolicy;
  nowMs?: number;
}): GoogleReviewOffer | null {
  const offer = buildReviewFunnelOffer(input);
  if (!offer || offer.route !== "google") return null;
  return offer;
}

export { buildReviewFunnelOffer } from "@/lib/denis/commerce/build-review-funnel-offer";
