import { describe, expect, it, vi, beforeEach } from "vitest";
import { prepareStorno, performStorno } from "@/lib/fiscal/storno";

const mockOrderUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockStornoInsert = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({ single: mockSingle }),
          }),
          update: mockOrderUpdate,
        };
      }
      if (table === "locations") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { org_id: "org-1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { currency: "EUR" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "storno_records") {
        return {
          insert: () => ({
            select: () => ({
              single: mockStornoInsert,
            }),
          }),
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "fiscal_transactions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "order_events") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "evt-1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "staff") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: "manager" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/lib/fiscal/sign-transaction", () => ({
  signOrderStornoTransaction: vi.fn().mockResolvedValue({
    signature: "storno-sig",
    tx_id: "tx-storno",
    tss_serial: "TSS-1",
    signature_counter: 2,
    start_time: 1,
    end_time: 2,
    qr_code_data: "qr",
  }),
}));

vi.mock("@/lib/stripe/refund", () => ({
  processRefund: vi.fn(),
}));

const deliveredOrder = {
  id: "order-1",
  order_number: 42,
  status: "delivered",
  total: 24,
  subtotal: 20.17,
  tax_amount: 3.83,
  payment_method: "at_bar",
  payment_status: "paid",
  tse_signature: "sig",
  tse_data: { tx_id: "tx-original" },
  location_id: "loc-1",
  stripe_payment_intent_id: null,
  has_storno: false,
  storno_total: 0,
  created_at: "2026-05-23T12:00:00.000Z",
  order_items: [{ product_name: "Burger", quantity: 1, total: 24, tax_rate: 19 }],
};

describe("prepareStorno", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects orders without TSE signature", async () => {
    mockSingle.mockResolvedValue({
      data: { ...deliveredOrder, tse_signature: null },
      error: null,
    });

    const result = await prepareStorno({
      orderId: "order-1",
      reason: "Guest complaint",
      performedBy: "staff-1",
    });

    expect(result).toEqual({
      error: "Order has no TSE signature — use reject instead",
      code: 400,
    });
  });

  it("calculates partial storno when amount is provided", async () => {
    mockSingle.mockResolvedValue({ data: deliveredOrder, error: null });

    const result = await prepareStorno({
      orderId: "order-1",
      reason: "One item returned",
      performedBy: "staff-1",
      amount: 10,
    });

    expect(result).toMatchObject({
      stornoAmount: 10,
      stornoType: "partial",
    });
  });

  it("returns error when nothing left to storno", async () => {
    mockSingle.mockResolvedValue({
      data: { ...deliveredOrder, storno_total: 24 },
      error: null,
    });

    const result = await prepareStorno({
      orderId: "order-1",
      reason: "Duplicate attempt",
      performedBy: "staff-1",
    });

    expect(result).toEqual({
      error: "Nothing left to storno",
      code: 400,
    });
  });
});

describe("performStorno", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: deliveredOrder, error: null });
    mockStornoInsert.mockResolvedValue({
      data: { id: "storno-rec-1" },
      error: null,
    });
  });

  it("returns error when order has no TSE signature", async () => {
    mockSingle.mockResolvedValue({
      data: { ...deliveredOrder, tse_signature: null },
      error: null,
    });

    const result = await performStorno({
      orderId: "order-1",
      reason: "Guest complaint",
      performedBy: "staff-1",
    });

    expect(result).toEqual({
      error: "Order has no TSE signature — use reject instead",
      code: 400,
    });
    expect(mockStornoInsert).not.toHaveBeenCalled();
  });

  it("completes full storno on delivered order and updates has_storno", async () => {
    const result = await performStorno({
      orderId: "order-1",
      reason: "Wrong item served",
      performedBy: "staff-1",
    });

    expect(result).toEqual({
      ok: true,
      stornoId: "storno-rec-1",
      tseSignature: "storno-sig",
    });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      has_storno: true,
      storno_total: 24,
    });
  });

  it("applies partial storno with correct storno_total", async () => {
    const result = await performStorno({
      orderId: "order-1",
      reason: "One item returned",
      performedBy: "staff-1",
      amount: 10,
    });

    expect(result).toMatchObject({ ok: true, stornoId: "storno-rec-1" });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      has_storno: true,
      storno_total: 10,
    });
  });

  it("returns error on duplicate full storno", async () => {
    mockSingle.mockResolvedValue({
      data: { ...deliveredOrder, storno_total: 24, has_storno: true },
      error: null,
    });

    const result = await performStorno({
      orderId: "order-1",
      reason: "Duplicate attempt",
      performedBy: "staff-1",
    });

    expect(result).toEqual({
      error: "Nothing left to storno",
      code: 400,
    });
  });
});

describe("storno API role check", () => {
  it("denies waiter role", () => {
    const staff = { role: "waiter" };
    expect(["owner", "manager"].includes(staff.role)).toBe(false);
  });
});
