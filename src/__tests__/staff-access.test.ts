import { describe, expect, it } from "vitest";
import {
  PermissionDeniedError,
  assertPermission,
  can,
  resolveStaffAccess,
} from "@/lib/auth/staff-access";
import { ALL_PERMISSIONS } from "@/lib/auth/permission-catalog";
import { computeModulesForSurface } from "@/lib/auth/staff-modules";

const waiterStaff = { id: "staff-waiter", role: "waiter" as const };
const ownerStaff = { id: "staff-owner", role: "owner" as const };

describe("resolveStaffAccess", () => {
  it("waiter default has orders.read and not fiscal.shift.close", () => {
    const access = resolveStaffAccess(waiterStaff);
    expect(access.permissions.has("orders.read")).toBe(true);
    expect(access.permissions.has("fiscal.shift.close")).toBe(false);
    expect(access.primarySurface).toBe("waiter");
  });

  it("waiter + grant fiscal.shift.close includes close permission", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "fiscal.shift.close", granted: true },
    ]);
    expect(access.permissions.has("fiscal.shift.close")).toBe(true);
  });

  it("waiter + revoke payments.collect removes collect permission", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "payments.collect", granted: false },
    ]);
    expect(access.permissions.has("payments.collect")).toBe(false);
  });

  it("owner has all permissions and ignores revokes", () => {
    const access = resolveStaffAccess(ownerStaff, [
      { permission: "fiscal.shift.close", granted: false },
      { permission: "staff.manage", granted: false },
    ]);
    expect(access.permissions.size).toBe(ALL_PERMISSIONS.length);
    expect(access.permissions.has("fiscal.shift.close")).toBe(true);
    expect(access.permissions.has("staff.manage")).toBe(true);
  });

  it("manager template includes staff.manage", () => {
    const access = resolveStaffAccess({ id: "m1", role: "manager" });
    expect(access.permissions.has("staff.manage")).toBe(true);
  });
});

describe("assertPermission", () => {
  it("throws PermissionDeniedError when permission missing", () => {
    expect(() =>
      assertPermission(waiterStaff, "fiscal.shift.close")
    ).toThrow(PermissionDeniedError);
  });

  it("returns access when permission granted", () => {
    const access = assertPermission(waiterStaff, "orders.read");
    expect(access.permissions.has("orders.read")).toBe(true);
  });
});

describe("compliance guards", () => {
  it("fiscal.shift.close denied when POS is connected (vorsystem)", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "fiscal.shift.close", granted: true },
    ]);
    expect(
      can(access, "fiscal.shift.close", {
        posIntegration: {
          id: "pos-1",
          provider: "test",
          status: "connected",
        },
      })
    ).toBe(false);
  });

  it("fiscal.shift.close allowed in standalone mode", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "fiscal.shift.close", granted: true },
    ]);
    expect(can(access, "fiscal.shift.close", { posIntegration: null })).toBe(
      true
    );
  });
});

describe("computeModulesForSurface", () => {
  it("returns fiscal-close module when fiscal.shift.close granted", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "fiscal.shift.close", granted: true },
    ]);
    const modules = computeModulesForSurface(access, "waiter");
    expect(modules.some((m) => m.id === "fiscal-close")).toBe(true);
  });
});
