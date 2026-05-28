import { describe, expect, it } from "vitest";
import { resolveActiveApprovalOrderId } from "@/lib/guest/resolve-active-approval-order";

describe("resolveActiveApprovalOrderId", () => {
  it("prefers explicit approval order id", () => {
    expect(
      resolveActiveApprovalOrderId("order-a", {
        capabilities: { awaitingApproval: true },
        pendingApprovalOrderId: "order-b",
      })
    ).toBe("order-a");
  });

  it("falls back to context pending order", () => {
    expect(
      resolveActiveApprovalOrderId(null, {
        capabilities: { awaitingApproval: true },
        pendingApprovalOrderId: "order-b",
      })
    ).toBe("order-b");
  });

  it("returns null when not awaiting approval", () => {
    expect(
      resolveActiveApprovalOrderId(null, {
        capabilities: { awaitingApproval: false },
        pendingApprovalOrderId: "order-b",
      })
    ).toBeNull();
  });
});
