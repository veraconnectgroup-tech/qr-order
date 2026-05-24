import { describe, expect, it } from "vitest";
import {
  buildZBonHtml,
  businessDayUtcBounds,
  isCashPaymentMethod,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";

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
