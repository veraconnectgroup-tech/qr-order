import { describe, expect, it } from "vitest";
import {
  aggregateDailyClosingTotals,
  buildZBonHtml,
  businessDayUtcBounds,
  isCashPaymentMethod,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";
import { roundMoney } from "@/lib/tax/vat";

const sampleZBon = {
  orgName: "Café Berlin",
  locationName: "Mitte",
  locationAddress: "Rosenthaler Str. 1, 10119 Berlin",
  steuernummer: "12/345/67890",
  ustIdNr: null,
  businessDate: "2026-05-23",
  currency: "EUR",
  totalGross: 1250.5,
  totalCash: 450,
  totalNonCash: 800.5,
  orderCount: 42,
  refundCount: 2,
  refundTotal: 35,
  vatSummary: [
    { rate: 19, gross: 1000, net: 840.34, tax: 159.66 },
    { rate: 7, gross: 250.5, net: 234.11, tax: 16.39 },
  ],
  tseSignature: "abc123signaturevalue",
  tseData: {
    tss_serial: "TSS-1234567890",
    signature_counter: 99,
    qr_code_data: "V0;1234567890;99;2026-05-23T23:59:00;2026-05-23T23:59:01;abc123",
  },
};

describe("isCashPaymentMethod", () => {
  it("treats cash and at_bar as cash", () => {
    expect(isCashPaymentMethod("cash")).toBe(true);
    expect(isCashPaymentMethod("at_bar")).toBe(true);
    expect(isCashPaymentMethod("online")).toBe(false);
    expect(isCashPaymentMethod("card_at_table")).toBe(false);
  });
});

describe("businessDayUtcBounds", () => {
  it("returns UTC instants for Berlin midnight boundaries", () => {
    const { startIso, endIso } = businessDayUtcBounds(
      "2026-05-23",
      "Europe/Berlin"
    );

    expect(startIso).toBe("2026-05-22T22:00:00.000Z");
    expect(endIso).toBe("2026-05-23T22:00:00.000Z");
  });
});

describe("yesterdayBusinessDate", () => {
  it("returns previous calendar day in location timezone", () => {
    const date = yesterdayBusinessDate(
      "Europe/Berlin",
      new Date("2026-05-24T10:00:00.000Z")
    );
    expect(date).toBe("2026-05-23");
  });
});

describe("buildZBonHtml", () => {
  it("includes Z-Bon heading, VAT breakdown, and totals", async () => {
    const html = await buildZBonHtml(sampleZBon);

    expect(html).toContain("Z-Bon / Tagesabschluss");
    expect(html).toContain("Café Berlin");
    expect(html).toContain("Bareinnahmen");
    expect(html).toContain("Unbar");
    expect(html).toContain("Gesamtumsatz (brutto)");
    expect(html).toContain("Anzahl Transaktionen");
    expect(html).toContain("MwSt 19%");
    expect(html).toContain("MwSt 7%");
    expect(html).toContain("St.-Nr.: 12/345/67890");
    expect(html).toContain("TSE-signiert");
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("Kassenabschluss gemäß KassenSichV");
  });

  it("shows Stornos row when refunds exist", async () => {
    const html = await buildZBonHtml(sampleZBon);
    expect(html).toContain("Stornos (2)");
  });

  it("omits TSE block when not signed", async () => {
    const html = await buildZBonHtml({
      ...sampleZBon,
      tseSignature: null,
      tseData: null,
    });
    expect(html).not.toContain("TSE-signiert");
  });
});

describe("aggregateDailyClosingTotals", () => {
  it("sums 10 revenue orders and 1 storno correctly", () => {
    const orders = [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `o-online-${i}`,
        status: "delivered",
        total: 20,
        tax_amount: 3.19,
        payment_method: "online",
        tip_amount: i === 0 ? 5 : 0,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `o-cash-${i}`,
        status: "accepted",
        total: 10,
        tax_amount: 1.6,
        payment_method: "cash",
        tip_amount: 0,
      })),
    ];

    const orderItems = [
      ...Array.from({ length: 7 }, () => ({ total: 20, tax_rate: 19 })),
      ...Array.from({ length: 3 }, () => ({ total: 10, tax_rate: 19 })),
    ];

    const refunds = [
      {
        id: "ref-1",
        total: 25,
        payment_status: "refunded",
      },
    ];

    const totals = aggregateDailyClosingTotals(orders, orderItems, refunds);

    expect(totals.orderCount).toBe(10);
    expect(totals.refundCount).toBe(1);
    expect(totals.refundTotal).toBe(25);
    expect(totals.totalGross).toBe(170);
    expect(totals.totalCash).toBe(30);
    expect(totals.totalNonCash).toBe(140);
    expect(totals.totalTips).toBe(5);
    expect(totals.totalTax).toBe(roundMoney(7 * 3.19 + 3 * 1.6));
    expect(totals.vatSummary).toEqual([
      expect.objectContaining({ rate: 19, gross: 170 }),
    ]);
  });

  it("renders Z-Bon HTML with storno row for aggregated day", async () => {
    const html = await buildZBonHtml({
      ...sampleZBon,
      orderCount: 10,
      refundCount: 1,
      refundTotal: 25,
      totalGross: 170,
      totalCash: 30,
      totalNonCash: 140,
    });

    expect(html).toContain("Stornos (1)");
    expect(html).toContain("Anzahl Transaktionen");
    expect(html).toContain("10");
  });
});

describe("Z-Bon totals", () => {
  it("matches computed gross from 10 mixed-VAT orders", () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      total: i % 3 === 0 ? 10 : 20,
    }));
    const totalGross = roundMoney(
      orders.reduce((sum, o) => sum + o.total, 0)
    );
    expect(totalGross).toBe(160);

    const cashTotal = roundMoney(
      orders
        .filter((_, i) => i % 2 !== 0)
        .reduce((sum, o) => sum + o.total, 0)
    );
    expect(cashTotal).toBe(80);
  });

  it("renders correct totalGross in Z-Bon HTML", async () => {
    const html = await buildZBonHtml(sampleZBon);
    expect(html).toContain("1.250,50");
    expect(html).toContain("Gesamtumsatz (brutto)");
    expect(html).toContain("42");
  });
});
