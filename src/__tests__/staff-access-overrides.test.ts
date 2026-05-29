import { describe, expect, it } from "vitest";
import {
  resolveStaffAccess,
  type PermissionOverride,
} from "@/lib/auth/staff-access";
import { computeOverridesForStorage } from "@/lib/auth/permission-overrides";
import { loadStaffPermissionOverrides } from "@/lib/auth/load-staff-permission-overrides";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const waiterStaff = { id: "staff-waiter", role: "waiter" as const };

describe("staff permission overrides (effective access)", () => {
  it("grant fiscal.shift.close → effective permissions include close", () => {
    const overrides: PermissionOverride[] = [
      { permission: "fiscal.shift.close", granted: true },
    ];
    const access = resolveStaffAccess(waiterStaff, overrides);
    expect(access.permissions.has("fiscal.shift.close")).toBe(true);
  });

  it("revoke payments.collect → removed from effective permissions", () => {
    const overrides: PermissionOverride[] = [
      { permission: "payments.collect", granted: false },
    ];
    const access = resolveStaffAccess(waiterStaff, overrides);
    expect(access.permissions.has("payments.collect")).toBe(false);
  });

  it("computeOverridesForStorage round-trips grant and revoke", () => {
    const access = resolveStaffAccess(waiterStaff, [
      { permission: "fiscal.shift.close", granted: true },
      { permission: "payments.collect", granted: false },
    ]);
    const stored = computeOverridesForStorage("waiter", access.permissions);
    const restored = resolveStaffAccess(waiterStaff, stored);
    expect(restored.permissions.has("fiscal.shift.close")).toBe(true);
    expect(restored.permissions.has("payments.collect")).toBe(false);
  });
});

describe("loadStaffPermissionOverrides", () => {
  it("maps Supabase rows to PermissionOverride[]", async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              { permission: "fiscal.shift.close", granted: true },
              { permission: "payments.collect", granted: false },
              { permission: "unknown.permission", granted: true },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const overrides = await loadStaffPermissionOverrides(
      mockAdmin,
      "staff-waiter"
    );

    expect(overrides).toEqual([
      { permission: "fiscal.shift.close", granted: true },
      { permission: "payments.collect", granted: false },
    ]);
  });

  it("returns empty array on query error", async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: null,
            error: { message: "relation does not exist" },
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const overrides = await loadStaffPermissionOverrides(
      mockAdmin,
      "staff-waiter"
    );
    expect(overrides).toEqual([]);
  });
});
