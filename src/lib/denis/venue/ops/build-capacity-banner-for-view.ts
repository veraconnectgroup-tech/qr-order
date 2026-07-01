import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";
import type { CapacityBanner } from "@/lib/denis/venue/ops/capacity-banner";

type CapacityBannerViewState = {
  session: { id: string };
  table: { token: string };
  venue: { opsEffects: { capacityBanner?: CapacityBanner | null } };
};

/** Guest-facing capacity banner when capability is active (P4). */
export function buildCapacityBannerForView(input: {
  state: CapacityBannerViewState;
  policy?: CommercePolicy;
}): CapacityBanner | null {
  const cohortKey =
    input.state.session.id || input.state.table.token || "capacity";
  if (
    !isCommerceCapabilityActive({
      capabilityId: "kitchen.capacity_banner",
      cohortKey,
      policy: input.policy ?? DEFAULT_COMMERCE_POLICY,
    })
  ) {
    return null;
  }

  const banner = input.state.venue.opsEffects.capacityBanner;
  if (!banner?.showBanner) return null;
  return banner;
}
