import { describe, expect, it } from "vitest";
import { buildBelegHtml, parseBelegTseData } from "@/lib/fiscal/beleg";

const sampleBeleg = {
  orgName: "Café Berlin",
  locationName: "Mitte",
  locationAddress: "Rosenthaler Str. 1, 10119 Berlin",
  tableName: "Tisch 4",
  orderNumber: 7,
  createdAt: "2026-05-23T12:00:00.000Z",
  subtotal: 25,
  taxAmount: 3.5,
  total: 25,
  currency: "EUR",
  paymentMethod: "online",
  paymentStatus: "paid",
  inPersonPaymentLocation: "table" as const,
  items: [
    {
      product_name: "Espresso",
      quantity: 2,
      total: 10,
      tax_rate: 19,
      notes: null,
      modifiers: [],
    },
    {
      product_name: "Croissant",
      quantity: 1,
      total: 15,
      tax_rate: 7,
      notes: null,
      modifiers: [],
    },
  ],
  tseSignature: "abc123signaturevalue",
  steuernummer: "12/345/67890",
  tseData: {
    tss_serial: "TSS-1234567890",
    signature_counter: 42,
    qr_code_data: "V0;1234567890;42;2026-05-23T12:00:00;2026-05-23T12:00:01;abc123",
  },
};

describe("parseBelegTseData", () => {
  it("extracts TSE fields from order tse_data json", () => {
    expect(
      parseBelegTseData({
        tss_serial: "TSS-1",
        signature_counter: 1,
        qr_code_data: "V0;data",
      })
    ).toEqual({
      tss_serial: "TSS-1",
      signature_counter: 1,
      signature: undefined,
      qr_code_data: "V0;data",
    });
  });
});

describe("buildBelegHtml", () => {
  it("includes Kassenbeleg heading and mixed VAT rows", async () => {
    const html = await buildBelegHtml(sampleBeleg);

    expect(html).toContain("Kassenbeleg");
    expect(html).toContain("Café Berlin");
    expect(html).toContain("TSE-signiert");
    expect(html).toContain("TSE-Seriennummer: TSS-1234567890");
    expect(html).toContain("Signaturzähler: 42");
    expect(html).toContain("MwSt 19%");
    expect(html).toContain("MwSt 7%");
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("KassenSichV");
  });

  it("shows Steuernummer when set, preferring it over USt-IdNr", async () => {
    const html = await buildBelegHtml(sampleBeleg);
    expect(html).toContain("St.-Nr.: 12/345/67890");
  });

  it("shows USt-IdNr when Steuernummer is absent", async () => {
    const html = await buildBelegHtml({
      ...sampleBeleg,
      steuernummer: null,
      ustIdNr: "DE123456789",
    });
    expect(html).toContain("USt-IdNr: DE123456789");
    expect(html).not.toContain("St.-Nr.:");
  });
});
