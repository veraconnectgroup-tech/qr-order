import { describe, expect, it } from "vitest";
import {
  buildNewOrderAnnouncement,
  mergeAnnouncementItems,
} from "@/lib/denis/stations/new-order-announcement";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";

describe("mergeAnnouncementItems", () => {
  it("merges repeated items into one grouped line", () => {
    const merged = mergeAnnouncementItems([
      { productName: "Ćevapi", quantity: 1 },
      { productName: "Karađorđeva", quantity: 1 },
      { productName: "Ćevapi", quantity: 1 },
    ]);
    expect(merged).toEqual([
      { productName: "Ćevapi", quantity: 2 },
      { productName: "Karađorđeva", quantity: 1 },
    ]);
  });

  it("drops blank product names", () => {
    expect(mergeAnnouncementItems([{ productName: "  ", quantity: 1 }])).toEqual([]);
  });
});

describe("buildNewOrderAnnouncement", () => {
  it("builds a spoken summary with a bon number and quantities", () => {
    const text = buildNewOrderAnnouncement({
      tableName: "5",
      orderNumber: 41,
      items: [
        { productName: "Ćevapi", quantity: 2 },
        { productName: "Karađorđeva", quantity: 1 },
      ],
    });
    expect(text).toBe("Bon #41, sto 5: 2x Ćevapi, Karađorđeva.");
  });

  it("falls back to a generic bon label without an order number", () => {
    const text = buildNewOrderAnnouncement({
      tableName: "12",
      orderNumber: null,
      items: [{ productName: "Pivo", quantity: 1 }],
    });
    expect(text).toBe("Novi bon, sto 12: Pivo.");
  });

  it("returns null for an order with no items relevant to this station", () => {
    expect(
      buildNewOrderAnnouncement({ tableName: "5", orderNumber: 41, items: [] })
    ).toBeNull();
  });
});

describe("readBonsAloudEnabled config flag (ADR-053 M6)", () => {
  it("ships live — platform default is on", () => {
    expect(
      CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions.readBonsAloudEnabled
    ).toBe(true);
  });

  it("a per-location override turns it on through the real merge path", () => {
    const merged = mergeConciergeConfig(undefined, null, {
      ops: {
        stationQuestions: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
          readBonsAloudEnabled: true,
        },
      },
    });
    expect(merged.ops.stationQuestions.readBonsAloudEnabled).toBe(true);
  });
});
