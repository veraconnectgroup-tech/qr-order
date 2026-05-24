import { describe, expect, it } from "vitest";
import {
  businessDayUtcBounds,
  isCashPaymentMethod,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";

describe("isCashPaymentMethod", () => {
  it("treats cash and at_bar as cash", () => {
    expect(isCashPaymentMethod("cash")).toBe(true);
    expect(isCashPaymentMethod("at_bar")).toBe(true);
    expect(isCashPaymentMethod("online")).toBe(false);
    expect(isCashPaymentMethod("card_at_table")).toBe(false);
  });
});

describe("businessDayUtcBounds", () => {
  it("returns UTC instants for Berlin midnight boundaries", () => {
    const { startIso, endIso } = businessDayUtcBounds(
      "2026-05-23",
      "Europe/Berlin"
    );

    expect(startIso).toBe("2026-05-22T22:00:00.000Z");
    expect(endIso).toBe("2026-05-23T22:00:00.000Z");
  });
});

describe("yesterdayBusinessDate", () => {
  it("returns previous calendar day in location timezone", () => {
    const date = yesterdayBusinessDate(
      "Europe/Berlin",
      new Date("2026-05-24T10:00:00.000Z")
    );
    expect(date).toBe("2026-05-23");
  });
});
