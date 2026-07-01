import { describe, expect, it } from "vitest";
import {
  getVenueTemplate,
  VENUE_TEMPLATES,
} from "@/lib/venue-templates/template-registry";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";

describe("venue templates", () => {
  it("registers six venue templates", () => {
    expect(VENUE_TEMPLATES).toHaveLength(6);
    expect(getVenueTemplate("casual-restaurant")?.name).toBe("Casual Restaurant");
    expect(getVenueTemplate("fine-dining")?.defaults.persona?.tone).toBe("formal");
  });

  it("casual restaurant template merges into valid partial config", () => {
    const template = getVenueTemplate("casual-restaurant");
    expect(template).not.toBeNull();
    const merged = mergePartialConciergeConfig(null, template!.defaults);
    expect(merged.persona?.name).toBe("Denis");
    expect(merged.persona?.tone).toBe("warm_short");
    expect(merged.upsell?.maxUpsellsPerSession).toBe(2);
  });
});
