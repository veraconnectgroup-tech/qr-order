import { describe, expect, it } from "vitest";
import { parseBrowseEventFromPayload } from "@/lib/denis/cognition/browse/browse-event.schema";
import { normalizeDenisSignal } from "@/lib/denis/ingress/normalize-signal";
import { runBrowseFoldSuite } from "@/lib/denis/eval/run-browse-fold-fixture";

describe("Denis browse telemetry F1", () => {
  it("routes browse telemetry to sense channel", () => {
    const result = normalizeDenisSignal({
      type: "telemetry",
      kind: "browse",
      tableToken: "abc123def456ghi789jkl012mno345pq",
      payload: {
        browseEvent: {
          action: "view_product",
          productId: "11111111-1111-4111-8111-111111111111",
          productName: "Beef Burger",
          categoryPath: ["food", "burgers"],
          menuSection: "food",
          dwellMs: 5000,
          timestamp: "2026-06-07T16:40:00.000Z",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.signal.route).toBe("sense");
    expect(result.signal.senseChannel).toBe("telemetry.browse");
  });

  it("parses browseEvent payload", () => {
    const event = parseBrowseEventFromPayload({
      browseEvent: {
        action: "remove_from_cart",
        productId: "22222222-2222-4222-8222-222222222222",
        productName: "Pilsner",
        timestamp: "2026-06-07T16:41:00.000Z",
      },
    });
    expect(event?.action).toBe("remove_from_cart");
    expect(event?.productName).toBe("Pilsner");
  });

  it("browse fold eval suite passes", () => {
    const report = runBrowseFoldSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBeGreaterThan(0);
  });
});
