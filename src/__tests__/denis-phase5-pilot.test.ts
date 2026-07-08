import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  getInterventionEnforceViolations,
  isInterventionEnforceReady,
} from "@/lib/denis/config/resolve-intervention-enforce-ready";

describe("Phase 5 pilot enforce wiring", () => {
  it("Table OS pilot ships UPDS enforce with IJS shadow and full guardrails", () => {
    const config = mergeConciergeConfig(
      CONCIERGE_PLATFORM_DEFAULTS,
      null,
      TABLE_OS_PILOT_CONFIG_PATCH
    );

    expect(TABLE_OS_PILOT_CONFIG_PATCH.intervention?.mode).toBe("shadow");
    expect(TABLE_OS_PILOT_CONFIG_PATCH.mentalModel?.mode).toBe("enforce");
    expect(TABLE_OS_PILOT_CONFIG_PATCH.proactive?.offerEnrich).toBe(true);
    expect(TABLE_OS_PILOT_CONFIG_PATCH.ops?.agenticToolLoop?.legacySingleCallFallback).toBe(
      false
    );
    expect(TABLE_OS_PILOT_CONFIG_PATCH.ops?.lossPrevention?.enabled).toBe(true);
    expect(getInterventionEnforceViolations(config)).toEqual([]);
    expect(isInterventionEnforceReady(config)).toBe(true);
  });
});
