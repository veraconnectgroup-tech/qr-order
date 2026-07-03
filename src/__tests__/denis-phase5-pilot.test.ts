import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import {
  getInterventionEnforceViolations,
  isInterventionEnforceReady,
} from "@/lib/denis/config/resolve-intervention-enforce-ready";

describe("Phase 5 pilot enforce wiring", () => {
  it("Skyline pilot patch is IJS enforce-ready", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      ...TABLE_OS_PILOT_CONFIG_PATCH,
      proactive: {
        ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
        ...TABLE_OS_PILOT_CONFIG_PATCH.proactive,
      },
      mentalModel: {
        ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
        ...TABLE_OS_PILOT_CONFIG_PATCH.mentalModel,
      },
      intervention: {
        ...CONCIERGE_PLATFORM_DEFAULTS.intervention,
        ...TABLE_OS_PILOT_CONFIG_PATCH.intervention,
      },
    };

    expect(TABLE_OS_PILOT_CONFIG_PATCH.intervention?.mode).toBe("enforce");
    expect(TABLE_OS_PILOT_CONFIG_PATCH.mentalModel?.mode).toBe("enforce");
    expect(TABLE_OS_PILOT_CONFIG_PATCH.proactive?.offerEnrich).toBe(true);
    expect(getInterventionEnforceViolations(config)).toEqual([]);
    expect(isInterventionEnforceReady(config)).toBe(true);
  });
});
