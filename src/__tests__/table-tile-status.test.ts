import { describe, expect, it } from "vitest";
import { tableTileStatus } from "@/lib/dashboard/table-tile-status";

describe("tableTileStatus", () => {
  const base = {
    hasWaiterCall: false,
    hasPaymentRequest: false,
    session: null,
    activeOrders: [] as unknown[],
  };

  it("maps waiter call to attention", () => {
    expect(tableTileStatus({ ...base, hasWaiterCall: true })).toBe("attention");
  });

  it("maps payment request to payment", () => {
    expect(tableTileStatus({ ...base, hasPaymentRequest: true })).toBe("payment");
  });

  it("maps active session to occupied", () => {
    expect(tableTileStatus({ ...base, session: { id: "s1" } })).toBe("occupied");
  });

  it("maps active orders without session to occupied", () => {
    expect(
      tableTileStatus({ ...base, activeOrders: [{ id: "o1" }] })
    ).toBe("occupied");
  });

  it("defaults to available", () => {
    expect(tableTileStatus(base)).toBe("available");
  });

  it("prioritizes attention over payment and occupancy", () => {
    expect(
      tableTileStatus({
        hasWaiterCall: true,
        hasPaymentRequest: true,
        session: { id: "s1" },
        activeOrders: [{ id: "o1" }],
      })
    ).toBe("attention");
  });
});
