import { describe, expect, it } from "vitest";
import {
  computeAllowedSurfaces,
  resolveStaffAccess,
} from "@/lib/auth/staff-access";
import { ROLE_TEMPLATES, PRIMARY_SURFACE } from "@/lib/auth/role-templates";

const kitchenStaff = { id: "staff-kitchen", role: "kitchen" as const };

describe("kitchen role template", () => {
  it("ROLE_TEMPLATES.kitchen includes food read and status update", () => {
    expect(ROLE_TEMPLATES.kitchen).toContain("orders.read.food");
    expect(ROLE_TEMPLATES.kitchen).toContain("orders.update_status");
    expect(ROLE_TEMPLATES.kitchen).not.toContain("orders.read");
    expect(ROLE_TEMPLATES.kitchen).not.toContain("fiscal.shift.close");
  });

  it("PRIMARY_SURFACE.kitchen is kitchen", () => {
    expect(PRIMARY_SURFACE.kitchen).toBe("kitchen");
  });
});

describe("kitchen staff access", () => {
  it("resolves primary surface kitchen with food permissions", () => {
    const access = resolveStaffAccess(kitchenStaff);
    expect(access.primarySurface).toBe("kitchen");
    expect(access.permissions.has("orders.read.food")).toBe(true);
    expect(access.permissions.has("orders.update_status")).toBe(true);
    expect(access.permissions.has("orders.read")).toBe(false);
  });

  it("allowedSurfaces defaults to kitchen only", () => {
    const access = resolveStaffAccess(kitchenStaff);
    expect(access.allowedSurfaces).toEqual(["kitchen"]);
  });

  it("computeAllowedSurfaces for kitchen template is kitchen only", () => {
    const surfaces = computeAllowedSurfaces(
      new Set(ROLE_TEMPLATES.kitchen),
      "kitchen"
    );
    expect(surfaces).toEqual(["kitchen"]);
  });

  it("kitchen with surface.dashboard.access may open dashboard", () => {
    const access = resolveStaffAccess(kitchenStaff, [
      { permission: "surface.dashboard.access", granted: true },
    ]);
    expect(access.allowedSurfaces).toContain("kitchen");
    expect(access.allowedSurfaces).toContain("dashboard");
  });
});
