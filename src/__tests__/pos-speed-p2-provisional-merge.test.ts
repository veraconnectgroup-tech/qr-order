import { describe, expect, it, vi } from "vitest";
import {
  applyPosBroadcastEvent,
  createProvisionalMap,
  listActiveProvisionals,
  pruneExpiredProvisionals,
} from "@/lib/pos/provisional-merge";
import { PROVISIONAL_KITCHEN_TIMEOUT_MS } from "@/lib/pos/provisional-types";
import type { ProvisionalOrderPayload } from "@/lib/pos/provisional-types";

const basePayload = (
  overrides: Partial<ProvisionalOrderPayload> = {}
): ProvisionalOrderPayload => ({
  clientOrderId: "client-1",
  locationId: "loc-1",
  tableId: "table-1",
  tableName: "Tisch 4",
  staffId: "staff-1",
  items: [{ productName: "Pizza", quantity: 2 }],
  total: 24.5,
  createdAt: new Date(0).toISOString(),
  ...overrides,
});

describe("POS Speed P2 — provisional merge", () => {
  it("adds provisional_order to map keyed by clientOrderId", () => {
    const map = createProvisionalMap();
    const next = applyPosBroadcastEvent(map, {
      type: "provisional_order",
      payload: basePayload(),
    });

    expect(next.size).toBe(1);
    expect(next.get("client-1")?.payload.tableName).toBe("Tisch 4");
  });

  it("does not duplicate the same clientOrderId", () => {
    let map = createProvisionalMap();
    const event = {
      type: "provisional_order" as const,
      payload: basePayload(),
    };
    map = applyPosBroadcastEvent(map, event);
    map = applyPosBroadcastEvent(map, event);
    expect(map.size).toBe(1);
  });

  it("removes provisional on order_confirmed", () => {
    let map = createProvisionalMap();
    map = applyPosBroadcastEvent(map, {
      type: "provisional_order",
      payload: basePayload(),
    });
    map = applyPosBroadcastEvent(map, {
      type: "order_confirmed",
      clientOrderId: "client-1",
      orderId: "order-1",
      orderNumber: 127,
    });
    expect(map.size).toBe(0);
  });

  it("marks conflict without removing until timeout", () => {
    let map = createProvisionalMap();
    map = applyPosBroadcastEvent(map, {
      type: "provisional_order",
      payload: basePayload(),
    });
    map = applyPosBroadcastEvent(map, {
      type: "order_conflict",
      clientOrderId: "client-1",
      reason: "unavailable_products",
    });

    expect(map.get("client-1")?.conflictReason).toBe("unavailable_products");
    expect(listActiveProvisionals(map).length).toBe(1);
  });

  it("prunes expired provisionals after 30s without confirm", () => {
    const receivedAt = 1_000;
    let map = createProvisionalMap();
    map = applyPosBroadcastEvent(
      map,
      { type: "provisional_order", payload: basePayload({ clientOrderId: "a" }) },
      receivedAt
    );
    map = applyPosBroadcastEvent(
      map,
      { type: "provisional_order", payload: basePayload({ clientOrderId: "b" }) },
      receivedAt
    );

    const beforeTimeout = pruneExpiredProvisionals(
      map,
      receivedAt + PROVISIONAL_KITCHEN_TIMEOUT_MS - 1
    );
    expect(beforeTimeout.size).toBe(2);

    const afterTimeout = pruneExpiredProvisionals(
      map,
      receivedAt + PROVISIONAL_KITCHEN_TIMEOUT_MS
    );
    expect(afterTimeout.size).toBe(0);
  });

  it("keeps conflict entries past timeout until manually cleared", () => {
    const receivedAt = 0;
    let map = createProvisionalMap();
    map = applyPosBroadcastEvent(
      map,
      { type: "provisional_order", payload: basePayload() },
      receivedAt
    );
    map = applyPosBroadcastEvent(map, {
      type: "order_conflict",
      clientOrderId: "client-1",
      reason: "conflict",
    });

    const pruned = pruneExpiredProvisionals(
      map,
      receivedAt + PROVISIONAL_KITCHEN_TIMEOUT_MS + 5_000
    );
    expect(pruned.size).toBe(1);
  });

  it("listActiveProvisionals returns oldest first", () => {
    let map = createProvisionalMap();
    map = applyPosBroadcastEvent(
      map,
      { type: "provisional_order", payload: basePayload({ clientOrderId: "b" }) },
      200
    );
    map = applyPosBroadcastEvent(
      map,
      { type: "provisional_order", payload: basePayload({ clientOrderId: "a" }) },
      100
    );

    const list = listActiveProvisionals(map, 150);
    expect(list.map((e) => e.payload.clientOrderId)).toEqual(["a", "b"]);
  });

  it("rejects wrong-location provisional payloads at subscribe layer", () => {
    vi.useFakeTimers();
    const map = createProvisionalMap();
    const merged = applyPosBroadcastEvent(map, {
      type: "provisional_order",
      payload: basePayload({ locationId: "other-loc" }),
    });
    expect(merged.size).toBe(1);
    vi.useRealTimers();
  });
});
