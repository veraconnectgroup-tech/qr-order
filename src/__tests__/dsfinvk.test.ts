import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildDsfinvkCsvFiles,
  formatDsfinvkAmount,
  lineVatBreakdown,
  mapPaymentDsfinvk,
  mapUstSchluessel,
  type DsfinvkExportContext,
  zipDsfinvkCsvFiles,
} from "@/lib/export/dsfinvk";

function sampleContext(): DsfinvkExportContext {
  return {
    kasseId: "loc-001",
    locationName: "Skyline Lounge",
    locationAddress: "Hafenstraße 1",
    locationCity: "Hamburg",
    locationPostalCode: "20457",
    locationTimezone: "Europe/Berlin",
    currency: "EUR",
    fiskalyClientId: "client-abc",
    fiskalyTssId: "tss-xyz",
    closings: [
      {
        id: "closing-1",
        business_date: "2026-05-23",
        total_gross: 125.5,
        total_cash: 40,
        total_non_cash: 85.5,
        closed_at: "2026-05-23T22:05:00.000Z",
        order_count: 2,
      },
    ],
    closingNumberByDate: new Map([["2026-05-23", 1]]),
    orders: [
      {
        id: "order-001",
        order_number: 42,
        subtotal: 20.17,
        total: 24,
        tax_amount: 3.83,
        payment_method: "online",
        payment_status: "paid",
        status: "delivered",
        created_at: "2026-05-23T12:00:00.000Z",
        accepted_at: "2026-05-23T12:01:00.000Z",
        delivered_at: "2026-05-23T12:20:00.000Z",
        is_takeaway: false,
        tse_signature: "sig-value",
        tse_data: {
          tss_serial: "TSS-SN-001",
          signature_counter: 17,
          start_time: 1716465600,
          end_time: 1716465700,
          qr_code_data: "V0;TSS-SN-001;17;sig-value",
          client_id: "client-abc",
        },
        created_by_staff_id: null,
        order_source: "qr",
        order_items: [
          {
            product_name: "Burger",
            quantity: 1,
            total: 24,
            tax_rate: 19,
          },
        ],
      },
      {
        id: "order-002",
        order_number: 43,
        subtotal: 9.35,
        total: 10,
        tax_amount: 0.65,
        payment_method: "at_bar",
        payment_status: "paid",
        status: "cancelled",
        created_at: "2026-05-23T18:00:00.000Z",
        accepted_at: "2026-05-23T18:00:00.000Z",
        delivered_at: null,
        is_takeaway: true,
        tse_signature: null,
        tse_data: null,
        created_by_staff_id: "staff-1",
        order_source: "staff",
        order_items: [
          {
            product_name: "Salat",
            quantity: 1,
            total: 10,
            tax_rate: 7,
          },
        ],
      },
    ],
    staffNames: new Map([["staff-1", "Anna"]]),
  };
}

describe("dsfinvk helpers", () => {
  it("formats amounts with dot decimal separator", () => {
    expect(formatDsfinvkAmount(12.345)).toBe("12.35");
  });

  it("maps VAT keys per DSFinV-K", () => {
    expect(mapUstSchluessel(19)).toBe(1);
    expect(mapUstSchluessel(7)).toBe(2);
    expect(mapUstSchluessel(0)).toBe(5);
  });

  it("maps payment methods to Bar/Unbar", () => {
    expect(mapPaymentDsfinvk("online")).toMatchObject({
      typ: "Unbar",
      name: "Online-Zahlung",
    });
    expect(mapPaymentDsfinvk("at_bar")).toMatchObject({
      typ: "Bar",
      name: "Bargeld",
    });
    expect(mapPaymentDsfinvk("card_terminal")).toMatchObject({
      typ: "Unbar",
      name: "Kartenzahlung",
    });
  });

  it("calculates line VAT breakdown", () => {
    const result = lineVatBreakdown(11.9, 19);
    expect(result.gross).toBe(11.9);
    expect(result.net).toBe(10);
    expect(result.ust).toBe(1.9);
  });
});

describe("dsfinvk export files", () => {
  it("builds all 10 CSV files with BOM, semicolons, and CRLF", () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    expect(Object.keys(files).sort()).toEqual([
      "businesscases.csv",
      "cashpointclosing.csv",
      "lines.csv",
      "lines_vat.csv",
      "payment.csv",
      "stamm_kassen.csv",
      "stamm_orte.csv",
      "stamm_tse.csv",
      "transactions.csv",
      "transactions_tse.csv",
    ]);

    for (const content of Object.values(files)) {
      expect(content.startsWith("\uFEFF")).toBe(true);
      expect(content).toContain(";");
      expect(content).toContain("\r\n");
    }

    expect(files["transactions.csv"]).toContain("order-001");
    expect(files["transactions.csv"]).toContain("Stornobeleg");
    expect(files["transactions_tse.csv"]).toContain("TSS-SN-001");
    expect(files["transactions_tse.csv"]).not.toContain("order-002");
    expect(files["cashpointclosing.csv"]).toContain("125.50");
  });

  it("creates a ZIP archive containing all CSV files", async () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    const buffer = await zipDsfinvkCsvFiles(files);
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files)
      .filter((name) => !zip.files[name]?.dir)
      .sort();

    expect(names).toEqual([
      "businesscases.csv",
      "cashpointclosing.csv",
      "lines.csv",
      "lines_vat.csv",
      "payment.csv",
      "stamm_kassen.csv",
      "stamm_orte.csv",
      "stamm_tse.csv",
      "transactions.csv",
      "transactions_tse.csv",
    ]);
  });
});
