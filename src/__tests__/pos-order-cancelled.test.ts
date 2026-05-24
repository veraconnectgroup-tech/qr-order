import { describe, expect, it, vi, beforeEach } from "vitest";
import { handlePosOrderCancelled } from "@/lib/pos/inbound/handle-pos-order-cancelled";
import * as refundModule from "@/lib/stripe/refund";
import * as stornoModule from "@/lib/fiscal/sign-transaction";
import * as auditModule from "@/lib/audit/log";
import * as webhookModule from "@/lib/webhooks/dispatch";

describe("handlePosOrderCancelled", () => {
  const integration = {
    id: "int-1",
    location_id: "loc-1",
    provider: "deliverect" as const,
    config: {},
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns order_not_found when idempotency key misses", async () => {
    const admin = {
      from(table: string) {
        if (table === "orders") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    };

    const result = await handlePosOrderCancelled(
      admin as never,
      integration,
      "POS-404"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.message).toBe("order_not_found");
  });

  it("cancels pending order and dispatches webhook", async () => {
    const updates: Record<string, unknown>[] = [];

    vi.spyOn(stornoModule, "signOrderStornoById").mockResolvedValue(null);
    vi.spyOn(auditModule, "auditLog").mockResolvedValue(undefined);
    const webhookSpy = vi
      .spyOn(webhookModule, "dispatchOrgWebhook")
      .mockImplementation(() => {});

    const admin = {
      from(table: string) {
        if (table === "orders") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "order-1",
                    order_number: 42,
                    status: "accepted",
                    payment_status: "pending",
                    payment_method: "unset",
                    stripe_payment_intent_id: null,
                    total: 10,
                    created_at: new Date().toISOString(),
                    tse_signature: null,
                    location_id: "loc-1",
                  },
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updates.push(payload);
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === "locations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { org_id: "org-1" } }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    };

    const result = await handlePosOrderCancelled(
      admin as never,
      integration,
      "POS-123"
    );

    expect(result.ok).toBe(true);
    expect(updates).toContainEqual({
      status: "cancelled",
      rejection_reason: "Cancelled by POS",
    });
    expect(webhookSpy).toHaveBeenCalledWith(
      "org-1",
      "order.cancelled",
      expect.objectContaining({
        order_id: "order-1",
        external_order_id: "POS-123",
      })
    );
  });

  it("refunds paid Stripe orders before cancelling", async () => {
    const refundSpy = vi
      .spyOn(refundModule, "processRefund")
      .mockResolvedValue({ ok: true, refundId: "re_1", amount: 10 });

    const admin = {
      from(table: string) {
        if (table === "orders") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "order-2",
                    order_number: 7,
                    status: "accepted",
                    payment_status: "paid",
                    payment_method: "pos_online",
                    stripe_payment_intent_id: "pi_123",
                    total: 10,
                    created_at: new Date().toISOString(),
                    tse_signature: "sig",
                    location_id: "loc-1",
                  },
                }),
              }),
            }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "locations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { org_id: "org-1" } }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    };

    vi.spyOn(auditModule, "auditLog").mockResolvedValue(undefined);
    vi.spyOn(webhookModule, "dispatchOrgWebhook").mockImplementation(() => {});
    const stornoSpy = vi
      .spyOn(stornoModule, "signOrderStornoById")
      .mockResolvedValue(null);

    const result = await handlePosOrderCancelled(
      admin as never,
      integration,
      "POS-777"
    );

    expect(result.ok).toBe(true);
    expect(refundSpy).toHaveBeenCalled();
    expect(stornoSpy).not.toHaveBeenCalled();
  });
});
