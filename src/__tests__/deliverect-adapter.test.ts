import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliverectAdapter } from "@/lib/pos/adapters/deliverect";
import type { PosOrderPayload } from "@/lib/pos/types";

function basePayload(overrides: Partial<PosOrderPayload> = {}): PosOrderPayload {
  return {
    orderId: "order-1",
    orderNumber: 42,
    locationId: "loc-1",
    externalLocationId: null,
    tableName: "Table 5",
    total: 19.9,
    currency: "EUR",
    paymentState: "PAID",
    items: [
      {
        name: "Burger",
        quantity: 1,
        unitPrice: 12.5,
        total: 12.5,
        notes: null,
        taxRate: 0.19,
        modifiers: [],
      },
    ],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const config = { api_key: "test-key", channel_link_id: "channel-1" };

describe("DeliverectAdapter.pushOrder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends eat-in orderType and the table name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ _id: "deliverect-order-1" }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new DeliverectAdapter();
    await adapter.pushOrder(basePayload(), config);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);

    expect(body.orderType).toBe(3);
    expect(body.table).toBe("Table 5");
  });

  it("marks the order already-paid when paymentState is PAID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ _id: "deliverect-order-1" }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new DeliverectAdapter();
    await adapter.pushOrder(basePayload({ paymentState: "PAID" }), config);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);

    expect(body.orderIsAlreadyPaid).toBe(true);
    expect(body.payment.type).toBe(1);
  });

  it("marks the order not-paid when paymentState is UNPAID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ _id: "deliverect-order-1" }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new DeliverectAdapter();
    await adapter.pushOrder(basePayload({ paymentState: "UNPAID" }), config);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);

    expect(body.orderIsAlreadyPaid).toBe(false);
    expect(body.payment.type).toBe(0);
  });

  it("returns the Deliverect order id as externalId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ _id: "deliverect-order-1" }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new DeliverectAdapter();
    const result = await adapter.pushOrder(basePayload(), config);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe("deliverect-order-1");
  });

  it("throws with the Deliverect error body on a non-ok response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("channel link not found", { status: 422 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new DeliverectAdapter();
    await expect(adapter.pushOrder(basePayload(), config)).rejects.toThrow(
      /422/
    );
  });

  it("rejects when config is missing api_key or channel_link_id", async () => {
    const adapter = new DeliverectAdapter();
    await expect(
      adapter.pushOrder(basePayload(), { channel_link_id: "channel-1" })
    ).rejects.toThrow(/api_key/);
    await expect(
      adapter.pushOrder(basePayload(), { api_key: "test-key" })
    ).rejects.toThrow(/channel_link_id/);
  });
});
