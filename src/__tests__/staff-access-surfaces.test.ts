import { describe, expect, it } from "vitest";
import { computeAllowedSurfaces } from "@/lib/auth/staff-access";
import type { PermissionKey } from "@/lib/auth/permission-catalog";

function permSet(...keys: PermissionKey[]) {
  return new Set(keys);
}

describe("computeAllowedSurfaces", () => {
  it("waiter role defaults to waiter surface only", () => {
    const surfaces = computeAllowedSurfaces(
      permSet("orders.read", "tables.read"),
      "waiter"
    );
    expect(surfaces).toEqual(["waiter"]);
  });

  it("waiter with surface.dashboard.access includes dashboard", () => {
    const surfaces = computeAllowedSurfaces(
      permSet("orders.read", "surface.dashboard.access"),
      "waiter"
    );
    expect(surfaces).toContain("waiter");
    expect(surfaces).toContain("dashboard");
  });

  it("kitchen role defaults to kitchen surface only", () => {
    const surfaces = computeAllowedSurfaces(
      permSet("orders.read.food", "orders.update_status"),
      "kitchen"
    );
    expect(surfaces).toEqual(["kitchen"]);
  });

  it("staff role defaults to dashboard surface", () => {
    const surfaces = computeAllowedSurfaces(
      permSet("orders.read", "analytics.read"),
      "staff"
    );
    expect(surfaces).toEqual(["dashboard"]);
  });

  it("manager with surface.admin.access includes admin", () => {
    const surfaces = computeAllowedSurfaces(
      permSet("orders.read", "surface.admin.access"),
      "manager"
    );
    expect(surfaces).toContain("dashboard");
    expect(surfaces).toContain("admin");
  });

  it("owner with all surface permissions includes every surface", () => {
    const surfaces = computeAllowedSurfaces(
      permSet(
        "surface.waiter.access",
        "surface.bar.access",
        "surface.kitchen.access",
        "surface.dashboard.access",
        "surface.admin.access",
        "surface.fiscal.access"
      ),
      "owner"
    );
    expect(surfaces).toContain("waiter");
    expect(surfaces).toContain("bar");
    expect(surfaces).toContain("kitchen");
    expect(surfaces).toContain("dashboard");
    expect(surfaces).toContain("admin");
    expect(surfaces).toContain("fiscal");
  });
});
