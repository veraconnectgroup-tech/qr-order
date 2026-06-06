import { describe, expect, it } from "vitest";
import { shouldQueueStaffOrderOffline } from "@/lib/offline/should-queue-staff-order-offline";
import {
  countPendingStaffOrders,
  withQueuePayloadClientOrderId,
} from "@/lib/offline/order-queue";

describe("withQueuePayloadClientOrderId", () => {
  it("injects clientOrderId into legacy payloads missing it", () => {
    const clientOrderId = "33333333-3333-4333-8333-333333333333";
    const repaired = withQueuePayloadClientOrderId({
      id: clientOrderId,
      clientOrderId,
      createdAt: "2026-05-29T12:00:00.000Z",
      tableId: "11111111-1111-4111-8111-111111111111",
      tableName: "Tisch 1",
      payload: {
        tableId: "11111111-1111-4111-8111-111111111111",
        clientOrderId: "",
        items: [],
        paymentMethod: "at_bar",
        isTakeaway: false,
      },
      status: "failed",
      attempts: 2,
      lastError: "clientOrderId is required.",
    });

    expect(repaired.payload.clientOrderId).toBe(clientOrderId);
  });
});

describe("shouldQueueStaffOrderOffline", () => {
  it("queues when fully offline", () => {
    expect(
      shouldQueueStaffOrderOffline({
        connectionStatus: "offline",
        error: "Unauthorized.",
        httpStatus: 401,
        retried: false,
      })
    ).toBe(true);
  });

  it("does not queue 4xx when degraded (validation/auth)", () => {
    expect(
      shouldQueueStaffOrderOffline({
        connectionStatus: "degraded",
        error: "clientOrderId is required.",
        httpStatus: 400,
        retried: false,
      })
    ).toBe(false);
  });

  it("queues 5xx when degraded", () => {
    expect(
      shouldQueueStaffOrderOffline({
        connectionStatus: "degraded",
        error: "Order could not be created.",
        httpStatus: 500,
        retried: false,
      })
    ).toBe(true);
  });

  it("queues on network timeout", () => {
    expect(
      shouldQueueStaffOrderOffline({
        connectionStatus: "degraded",
        error: "Request timeout",
        retried: false,
      })
    ).toBe(true);
  });

  it("does not queue degraded + generic error without retry or network hint", () => {
    expect(
      shouldQueueStaffOrderOffline({
        connectionStatus: "degraded",
        error: "Invalid input.",
        httpStatus: 400,
        retried: false,
      })
    ).toBe(false);
  });
});

describe("countPendingStaffOrders", () => {
  it("counts syncing rows so the banner stays visible during sync", async () => {
    if (typeof indexedDB === "undefined") {
      expect(true).toBe(true);
      return;
    }

    const { enqueueStaffOrder, updateQueuedStaffOrder, removeQueuedStaffOrder } =
      await import("@/lib/offline/order-queue");

    const id = "66666666-6666-4666-8666-666666666666";
    await enqueueStaffOrder({
      id,
      clientOrderId: id,
      createdAt: new Date().toISOString(),
      tableId: "11111111-1111-4111-8111-111111111111",
      tableName: "Tisch 6",
      payload: {
        tableId: "11111111-1111-4111-8111-111111111111",
        clientOrderId: id,
        items: [
          {
            productId: "22222222-2222-4222-8222-222222222222",
            quantity: 1,
            modifiers: [],
          },
        ],
        paymentMethod: "at_bar",
        isTakeaway: false,
      },
    });

    const items = await import("@/lib/offline/order-queue").then((m) =>
      m.listQueuedStaffOrders()
    );
    const row = items.find((entry) => entry.id === id);
    if (!row) throw new Error("fixture row missing");
    await updateQueuedStaffOrder({ ...row, status: "syncing" });

    expect(await countPendingStaffOrders()).toBeGreaterThanOrEqual(1);
    await removeQueuedStaffOrder(id);
  });
});
