import { describe, expect, it } from "vitest";
import { formatLearnedEdgeLift } from "@/lib/admin/sync-discovered-pairings";

describe("sync discovered pairings X1 admin", () => {
  it("formats lift signal for learned edge rows", () => {
    const label = formatLearnedEdgeLift({
      suggested_weight: 0.56,
      accept_rate: 0.82,
      impressions: 91,
    });
    expect(label).toContain("82%");
    expect(label).toContain("lift 2.8");
    expect(label).toContain("n=91");
  });
});
