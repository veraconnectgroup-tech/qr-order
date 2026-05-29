import { describe, expect, it } from "vitest";
import { resolveStaffAccess } from "@/lib/auth/staff-access";
import { computeModulesForSurface } from "@/lib/auth/staff-modules";
import { PRIMARY_SURFACE } from "@/lib/auth/role-templates";
import { computeAllowedSurfaces } from "@/lib/auth/staff-access";

const barStaff = { id: "staff-bar", role: "bar" as const };

describe("bar role template", () => {
  it("has orders.read.drinks permission", () => {
    const access = resolveStaffAccess(barStaff);
    expect(access.permissions.has("orders.read.drinks")).toBe(true);
    expect(access.permissions.has("orders.read")).toBe(false);
  });

  it("primary surface is bar", () => {
    const access = resolveStaffAccess(barStaff);
    expect(access.primarySurface).toBe("bar");
    expect(PRIMARY_SURFACE.bar).toBe("bar");
  });

  it("defaults to bar surface only", () => {
    const access = resolveStaffAccess(barStaff);
    expect(computeAllowedSurfaces(access.permissions, "bar")).toEqual(["bar"]);
  });

  it("includes drink queue module", () => {
    const access = resolveStaffAccess(barStaff);
    const modules = computeModulesForSurface(access, "bar");
    expect(modules.some((m) => m.id === "queue")).toBe(true);
  });

  it("has orders.update_status and payments.collect", () => {
    const access = resolveStaffAccess(barStaff);
    expect(access.permissions.has("orders.update_status")).toBe(true);
    expect(access.permissions.has("payments.collect")).toBe(true);
    expect(access.permissions.has("orders.create")).toBe(true);
  });
});
