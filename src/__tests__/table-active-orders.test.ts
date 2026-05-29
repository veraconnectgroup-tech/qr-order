import { describe, expect, it } from "vitest";
import {
  isActiveTableOrder,
  isUnpaidTableOrder,
} from "@/lib/dashboard/table-active-orders";

describe("table active orders", () => {
  const session = { id: "session-1" };

  it("ignores paid orders even when kitchen status is still open", () => {
    expect(
      isActiveTableOrder(
        {
          payment_status: "paid",
          status: "pending",
          session_id: "session-1",
        },
        session
      )
    ).toBe(false);
  });

  it("keeps unpaid session orders active", () => {
    expect(
      isActiveTableOrder(
        {
          payment_status: "pending",
          status: "preparing",
          session_id: "session-1",
        },
        session
      )
    ).toBe(true);
  });

  it("treats orphan unpaid kitchen orders as active without a session", () => {
    expect(
      isActiveTableOrder(
        {
          payment_status: "pending",
          status: "ready",
          session_id: null,
        },
        null
      )
    ).toBe(true);
  });

  it("drops delivered unpaid orders once session is closed", () => {
    expect(
      isActiveTableOrder(
        {
          payment_status: "pending",
          status: "delivered",
          session_id: "session-1",
        },
        null
      )
    ).toBe(false);
  });

  it("detects unpaid orders", () => {
    expect(isUnpaidTableOrder({ payment_status: "paid" })).toBe(false);
    expect(isUnpaidTableOrder({ payment_status: "pending" })).toBe(true);
  });
});
