import type {
  CommerceCapabilityConfig,
  CommerceCapabilityId,
} from "@/lib/commerce/policy/commerce-policy.schema";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import {
  isInCanaryCohort,
  resolveEffectiveRollout,
} from "@/lib/denis/config/rollout";

export function resolveCommerceCapabilityConfig(
  capabilityId: CommerceCapabilityId,
  policy = DEFAULT_COMMERCE_POLICY
): CommerceCapabilityConfig {
  return policy.capabilities[capabilityId];
}

/** Whether a commerce capability is active for this table session (P1 canary rollout). */
export function isCommerceCapabilityActive(input: {
  capabilityId: CommerceCapabilityId;
  cohortKey: string;
  policy?: typeof DEFAULT_COMMERCE_POLICY;
}): boolean {
  const config = resolveCommerceCapabilityConfig(
    input.capabilityId,
    input.policy ?? DEFAULT_COMMERCE_POLICY
  );
  if (!config.enabled) return false;

  const rollout = resolveEffectiveRollout({ rollout: config.rollout });
  if (rollout.mode === "shadow") return false;
  if (rollout.mode === "legacy") return false;
  if (rollout.mode === "denis_only") return true;
  if (rollout.mode === "simulation") return true;
  if (rollout.mode === "canary") {
    return isInCanaryCohort(input.cohortKey, rollout.canaryPercent);
  }
  return false;
}
