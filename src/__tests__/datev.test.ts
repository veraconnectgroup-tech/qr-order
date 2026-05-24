import { describe, expect, it } from "vitest";
import { DATEV_ACCOUNTS, orderToDatevRows } from "@/lib/export/datev";

describe("orderToDatevRows", () => {
  it("emits separate 8400 and 8300 rows for mixed VAT order", () => {
    const rows = orderToDatevRows({
      id: "00000000-0000-4000-8000-000000000001",
      order_number: 42,
      subtotal: 25,
      total: 25,
      tax_amount: 3.5,
      tax_percent: 19,
      payment_method: "online",
      created_at: "2026-05-23T12:00:00.000Z",
      status: "delivered",
      order_items: [
        { total: 10, tax_rate: 19 },
        { total: 15, tax_rate: 7 },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      umsatz: 10,
      konto: DATEV_ACCOUNTS.revenue19,
      ustSatz: 19,
      gegenkonto: DATEV_ACCOUNTS.bankStripe,
    });
    expect(rows[1]).toMatchObject({
      umsatz: 15,
      konto: DATEV_ACCOUNTS.revenue7,
      ustSatz: 7,
    });
  });

  it("emits single row for uniform 19% order", () => {
    const rows = orderToDatevRows({
      id: "00000000-0000-4000-8000-000000000002",
      order_number: 1,
      subtotal: 20,
      total: 20,
      tax_amount: 3.19,
      tax_percent: 19,
      payment_method: "at_bar",
      created_at: "2026-05-23T12:00:00.000Z",
      status: "delivered",
      order_items: [{ total: 20, tax_rate: 19 }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.konto).toBe(DATEV_ACCOUNTS.revenue19);
    expect(rows[0]?.gegenkonto).toBe(DATEV_ACCOUNTS.cashBar);
  });
});
