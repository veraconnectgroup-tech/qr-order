import { describe, expect, it } from "vitest";
import {
  resolveTableActionChips,
  resolveSituationOrderAction,
  TABLE_ACTION_CHIP_IDS,
} from "@/lib/scene/resolve-table-actions";

describe("resolveTableActionChips", () => {
  it("always offers order more on active sessions", () => {
    const chips = resolveTableActionChips({
      phase: "waiting",
      hasUnpaidOrders: false,
    });
    expect(chips.some((c) => c.id === TABLE_ACTION_CHIP_IDS.orderMore)).toBe(
      true
    );
  });

  it("adds view bill when unpaid orders exist", () => {
    const chips = resolveTableActionChips({
      phase: "settling",
      hasUnpaidOrders: true,
    });
    expect(chips.some((c) => c.id === TABLE_ACTION_CHIP_IDS.viewBill)).toBe(
      true
    );
  });
});

describe("resolveSituationOrderAction", () => {
  it("opens order for kitchen-active statuses", () => {
    expect(
      resolveSituationOrderAction({
        orderId: "o1",
        status: "preparing",
        paymentStatus: "pending",
      })
    ).toEqual({ kind: "open_order", orderId: "o1" });
  });

  it("opens bill for delivered unpaid orders", () => {
    expect(
      resolveSituationOrderAction({
        orderId: "o1",
        status: "delivered",
        paymentStatus: "pending",
      })
    ).toEqual({ kind: "open_bill", scope: "order", orderId: "o1" });
  });

  it("keeps order focus for ready unpaid orders", () => {
    expect(
      resolveSituationOrderAction({
        orderId: "o1",
        status: "ready",
        paymentStatus: "pending",
      })
    ).toEqual({ kind: "open_order", orderId: "o1" });
  });
});
