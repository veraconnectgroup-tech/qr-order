import { describe, expect, it } from "vitest";
import {
  canaryCohortBucket,
  isInCanaryCohort,
  resolveGuestLegacyPath,
} from "@/lib/denis/config/rollout";

describe("Denis canary rollout M27", () => {
  it("assigns stable cohort bucket per token", () => {
    const a = canaryCohortBucket("table-token-abc");
    const b = canaryCohortBucket("table-token-abc");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it("0% canary is always legacy", () => {
    expect(
      resolveGuestLegacyPath("canary", {
        cohortKey: "tok",
        canaryPercent: 0,
      })
    ).toBe(true);
    expect(isInCanaryCohort("tok", 0)).toBe(false);
  });

  it("100% canary is always Denis guest path", () => {
    expect(
      resolveGuestLegacyPath("canary", {
        cohortKey: "tok",
        canaryPercent: 100,
      })
    ).toBe(false);
  });

  it("shadow and legacy stay legacy", () => {
    expect(resolveGuestLegacyPath("shadow", { cohortKey: "tok" })).toBe(true);
    expect(resolveGuestLegacyPath("denis_only", { cohortKey: "tok" })).toBe(
      false
    );
  });
});
