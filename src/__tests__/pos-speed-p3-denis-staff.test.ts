import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistOrderSideEffectsInput } from "@/lib/outbox/persist-order-side-effects";

const persistMock = vi.fn().mockResolvedValue(undefined);
const denisMock = vi.fn();

vi.mock("@/lib/outbox/persist-order-side-effects", () => ({
  persistOrderSideEffects: (...args: unknown[]) => persistMock(...args),
}));

vi.mock("@/lib/outbox/enqueue-denis-world-signal", () => ({
  scheduleDenisWorldSignal: (...args: unknown[]) => denisMock(...args),
}));

const sideEffects: PersistOrderSideEffectsInput = {
  orderId: "order-staff-1",
  locationId: "loc-1",
  orgId: "org-1",
  orderNumber: 127,
  tableName: "Tisch 5",
  total: 24.5,
  paymentStatus: "pending",
  orderSource: "staff",
  phase: "created",
  actorType: "staff",
  actorId: "staff-1",
};

describe("POS Speed P3 — Denis staff parity", () => {
  beforeEach(() => {
    persistMock.mockClear();
    denisMock.mockClear();
  });

  it("emitStaffOrderSideEffects persists outbox then schedules Denis once", async () => {
    const { emitStaffOrderSideEffects } = await import(
      "@/lib/orders/emit-staff-order-side-effects"
    );
    const admin = {} as ReturnType<
      typeof import("@/lib/supabase/admin").createAdminClient
    >;

    await emitStaffOrderSideEffects(admin, {
      sideEffects,
      sessionId: "session-1",
    });

    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(persistMock).toHaveBeenCalledWith(admin, sideEffects);
    expect(denisMock).toHaveBeenCalledTimes(1);
    expect(denisMock).toHaveBeenCalledWith({
      signal: "commerce.order_created",
      orderId: "order-staff-1",
      sessionId: "session-1",
      status: "pending",
    });
  });

  it("Denis runs after persist (call order)", async () => {
    const callOrder: string[] = [];
    persistMock.mockImplementation(async () => {
      callOrder.push("persist");
    });
    denisMock.mockImplementation(() => {
      callOrder.push("denis");
    });

    const { emitStaffOrderSideEffects } = await import(
      "@/lib/orders/emit-staff-order-side-effects"
    );
    const admin = {} as ReturnType<
      typeof import("@/lib/supabase/admin").createAdminClient
    >;

    await emitStaffOrderSideEffects(admin, {
      sideEffects,
      sessionId: "session-2",
    });

    expect(callOrder).toEqual(["persist", "denis"]);
  });
});
