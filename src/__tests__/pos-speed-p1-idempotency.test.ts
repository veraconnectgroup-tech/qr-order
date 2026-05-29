import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStaffOrderSchema,
  type CreateStaffOrderInput,
} from "@/lib/orders/create-staff-order";
import { isPosLocalFirstEnabled } from "@/lib/pos/feature-flags";

const TABLE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ORDER_ID = "33333333-3333-4333-8333-333333333333";
const LOCATION_ID = "44444444-4444-4444-8444-444444444444";

function baseOrderInput(
  overrides: Partial<CreateStaffOrderInput> = {}
): CreateStaffOrderInput {
  return createStaffOrderSchema.parse({
    tableId: TABLE_ID,
    items: [{ productId: PRODUCT_ID, quantity: 1, modifiers: [] }],
    paymentMethod: "at_bar",
    isTakeaway: false,
    ...overrides,
  });
}

describe("POS Speed P1 — idempotency", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("createStaffOrderSchema accepts clientOrderId, menuVersion, clientSnapshot", () => {
    const parsed = createStaffOrderSchema.safeParse(
      baseOrderInput({
        clientOrderId: CLIENT_ORDER_ID,
        menuVersion: "2026-05-29T12:00:00.000Z",
        clientSnapshot: {
          subtotal: 8.4,
          taxAmount: 1.6,
          total: 10,
          items: [
            {
              productId: PRODUCT_ID,
              quantity: 1,
              lineTotal: 10,
              taxRate: 19,
              unitPrice: 10,
              modifierTotal: 0,
            },
          ],
        },
      })
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.clientOrderId).toBe(CLIENT_ORDER_ID);
      expect(parsed.data.menuVersion).toBe("2026-05-29T12:00:00.000Z");
    }
  });

  it("isPosLocalFirstEnabled is false by default", () => {
    delete process.env.POS_LOCAL_FIRST;
    delete process.env.NEXT_PUBLIC_POS_LOCAL_FIRST;
    expect(isPosLocalFirstEnabled(LOCATION_ID)).toBe(false);
  });

  it("isPosLocalFirstEnabled respects global flag", () => {
    process.env.NEXT_PUBLIC_POS_LOCAL_FIRST = "true";
    expect(isPosLocalFirstEnabled(LOCATION_ID)).toBe(true);
  });

  it("isPosLocalFirstEnabled respects location allowlist", () => {
    process.env.POS_LOCAL_FIRST = "true";
    process.env.POS_LOCAL_FIRST_LOCATIONS = LOCATION_ID;
    expect(isPosLocalFirstEnabled(LOCATION_ID)).toBe(true);
    expect(isPosLocalFirstEnabled("55555555-5555-4555-8555-555555555555")).toBe(
      false
    );
  });

  it("idempotent replay skips side effects (unit contract)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "staff_order_idempotency") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      order_id: "order-existing",
                      orders: {
                        order_number: 127,
                        total: 19.9,
                        tables: { name: "Table 5" },
                      },
                    },
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      }),
    }));

    const { createStaffOrder } = await import("@/lib/orders/create-staff-order");
    const staff = {
      id: "staff-1",
      org_id: "org-1",
      location_id: LOCATION_ID,
      role: "waiter",
    } as import("@/types").Staff;

    const result = await createStaffOrder(
      staff,
      baseOrderInput({ clientOrderId: CLIENT_ORDER_ID })
    );

    expect(result.data).toMatchObject({
      orderId: "order-existing",
      orderNumber: 127,
      idempotent: true,
    });
    expect("sideEffects" in result).toBe(false);
  });
});
