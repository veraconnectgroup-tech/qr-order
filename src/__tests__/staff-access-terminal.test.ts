import { describe, expect, it } from "vitest";
import {
  assertPermission,
  PermissionDeniedError,
  resolveStaffAccess,
} from "@/lib/auth/staff-access";

const waiterStaff = { id: "w1", role: "waiter" as const };

describe("terminal API permissions (ADR-024)", () => {
  it("waiter default can use payments.collect (connection-token / payment-intent)", () => {
    const access = assertPermission(waiterStaff, "payments.collect");
    expect(access.permissions.has("payments.collect")).toBe(true);
  });

  it("waiter + revoke payments.collect → 403 on collect", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "payments.collect", granted: false },
    ]);
    expect(access.permissions.has("payments.collect")).toBe(false);
    expect(() => assertPermission(waiterStaff, "payments.collect", [
      { permission: "payments.collect", granted: false },
    ])).toThrow(PermissionDeniedError);
  });

  it("waiter cannot manage terminal readers (settings.manage)", () => {
    expect(() => assertPermission(waiterStaff, "settings.manage")).toThrow(
      PermissionDeniedError
    );
  });

  it("manager can manage terminal readers", () => {
    const access = assertPermission(
      { id: "m1", role: "manager" },
      "settings.manage"
    );
    expect(access.permissions.has("settings.manage")).toBe(true);
  });
});
