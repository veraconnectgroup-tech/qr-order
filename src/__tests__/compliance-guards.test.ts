import { describe, expect, it } from "vitest";
import { runComplianceGuards } from "@/lib/auth/compliance-guards";
import { can, resolveStaffAccess } from "@/lib/auth/staff-access";

describe("runComplianceGuards", () => {
  it("blocks fiscal.shift.close when POS is connected (vorsystem)", () => {
    expect(
      runComplianceGuards("fiscal.shift.close", {
        locationId: "loc-1",
        posIntegration: {
          id: "pos-1",
          provider: "gastrofix",
          status: "connected",
        },
      })
    ).toBe(false);
  });

  it("allows fiscal.shift.close in standalone mode", () => {
    expect(
      runComplianceGuards("fiscal.shift.close", {
        locationId: "loc-1",
        posIntegration: null,
      })
    ).toBe(true);
  });

  it("skips standalone guard when posIntegration is omitted", () => {
    expect(runComplianceGuards("fiscal.shift.close")).toBe(true);
  });

  it("does not block read-only fiscal permissions", () => {
    expect(
      runComplianceGuards("fiscal.shift.read", {
        posIntegration: {
          id: "pos-1",
          provider: "gastrofix",
          status: "connected",
        },
      })
    ).toBe(true);
  });
});

describe("can with compliance context", () => {
  it("denies fiscal.shift.close for manager on vorsystem location", () => {
    const access = resolveStaffAccess({ id: "m1", role: "manager" });
    expect(
      can(access, "fiscal.shift.close", {
        locationId: "loc-1",
        posIntegration: {
          id: "pos-1",
          provider: "gastrofix",
          status: "connected",
        },
      })
    ).toBe(false);
  });
});
