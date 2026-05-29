import { describe, expect, it } from "vitest";
import { buildFiscalSaleLines } from "@/lib/fiscal/runtime/build-fiscal-sale-lines";
import { resolveFiscalMoment } from "@/lib/fiscal/resolve-fiscal-moment";

describe("resolveFiscalMoment", () => {
  it("returns payment_confirmed when paid in standalone mode", () => {
    expect(
      resolveFiscalMoment({
        paymentStatus: "paid",
        paymentMethod: "online",
        status: "accepted",
        posIntegration: null,
      })
    ).toBe("payment_confirmed");
  });

  it("returns pos_fiscal_export when POS connected", () => {
    expect(
      resolveFiscalMoment({
        paymentStatus: "paid",
        paymentMethod: "online",
        status: "accepted",
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
      })
    ).toBe("pos_fiscal_export");
  });

  it("returns never for unpaid online orders", () => {
    expect(
      resolveFiscalMoment({
        paymentStatus: "pending",
        paymentMethod: "online",
        status: "accepted",
        posIntegration: null,
      })
    ).toBe("never");
  });
});

describe("buildFiscalSaleLines", () => {
  it("extracts gross-inclusive VAT per line", () => {
    const result = buildFiscalSaleLines([
      {
        product_name: "Coffee",
        quantity: 1,
        total: 11.9,
        tax_rate: 19,
      },
    ]);

    expect(result.gross_total).toBe(11.9);
    expect(result.net_total).toBe(10);
    expect(result.tax_total).toBe(1.9);
    expect(result.lines[0]).toMatchObject({
      line_no: 1,
      gross: 11.9,
      net: 10,
      tax: 1.9,
    });
  });
});
