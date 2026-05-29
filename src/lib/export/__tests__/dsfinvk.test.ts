import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildDsfinvkCsvFiles,
  buildStornoBonOrder,
  dsfinvkStornoSign,
  formatDsfinvkAmount,
  lineVatBreakdown,
  mapPaymentDsfinvk,
  mapUstSchluessel,
  type DsfinvkExportContext,
  type DsfinvkOrderRow,
  zipDsfinvkCsvFiles,
} from "@/lib/export/dsfinvk";

const originalStornoOrder: DsfinvkOrderRow = {
  id: "order-002",
  order_number: 43,
  subtotal: 9.35,
  total: 10,
  tax_amount: 0.65,
  payment_method: "at_bar",
  payment_status: "paid",
  status: "delivered",
  created_at: "2026-05-23T18:00:00.000Z",
  accepted_at: "2026-05-23T18:00:00.000Z",
  delivered_at: "2026-05-23T18:05:00.000Z",
  is_takeaway: true,
  tse_signature: "original-sig",
  tse_data: {
    tss_serial: "TSS-SN-001",
    signature_counter: 18,
    tx_id: "tx-original",
    client_id: "client-abc",
  },
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
};

function sampleContext(): DsfinvkExportContext {
  const stornoBonOrders = [
    buildStornoBonOrder(
      {
        id: "storno-rec-1",
        original_order_id: "order-002",
        storno_amount: 10,
        created_at: "2026-05-23T19:00:00.000Z",
        tse_storno_signature: "storno-sig",
        tse_storno_data: {
          tss_serial: "TSS-SN-001",
          signature_counter: 19,
          tx_id: "tx-storno",
          client_id: "client-abc",
        },
      },
      originalStornoOrder
    ),
  ];

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
        z_nr: 1,
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
      originalStornoOrder,
    ],
    stornoBonOrders,
    stornoRecords: new Map([
      [
        "storno-rec-1",
        {
          originalOrderId: "order-002",
          stornoAmount: 10,
          createdAt: "2026-05-23T19:00:00.000Z",
          originalCreatedAt: "2026-05-23T18:00:00.000Z",
        },
      ],
    ]),
    staffNames: new Map([["staff-1", "Anna"]]),
  };
}

function parseCsvRows(content: string): string[][] {
  const body = content.replace(/^\uFEFF/, "").trim();
  return body.split("\r\n").map((line) => line.split(";"));
}

function findTransactionRow(content: string, bonId: string): string[] | undefined {
  const [header, ...rows] = parseCsvRows(content);
  const bonIdIndex = header.indexOf("BON_ID");
  return rows.find((row) => row[bonIdIndex] === bonId);
}

function findReferenceRow(content: string, bonId: string): string[] | undefined {
  const [header, ...rows] = parseCsvRows(content);
  const bonIdIndex = header.indexOf("BON_ID");
  return rows.find((row) => row[bonIdIndex] === bonId);
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
  });

  it("calculates line VAT breakdown", () => {
    const result = lineVatBreakdown(11.9, 19);
    expect(result.gross).toBe(11.9);
    expect(result.net).toBe(10);
    expect(result.ust).toBe(1.9);
  });

  it("uses -1 sign for storno belege", () => {
    expect(dsfinvkStornoSign({ status: "delivered", is_storno_beleg: true })).toBe(
      -1
    );
    expect(dsfinvkStornoSign({ status: "delivered" })).toBe(1);
  });
});

describe("H12/H13 DSFinV-K storno compliance", () => {
  it("exports storno beleg from storno_records with negative amounts", () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    const row = findTransactionRow(files["transactions.csv"], "storno-rec-1");

    expect(row).toBeDefined();
    expect(row![4]).toBe("Beleg");
    expect(row![5]).toBe("Stornobeleg");
    expect(row![7]).toBe("1");
    expect(row![12]).toBe("-10.00");
    expect(row![13]).toBe("-9.35");

    expect(files["lines.csv"]).toContain("-10.00");
    expect(files["payment.csv"]).toContain("-10.00");
    expect(findTransactionRow(files["transactions.csv"], "order-002")![7]).toBe(
      "0"
    );
  });

  it("fills bon_referenzen with original order reference", () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    const refRow = findReferenceRow(files["bon_referenzen.csv"], "storno-rec-1");

    expect(refRow).toBeDefined();
    expect(refRow![8]).toBe("1");
    expect(refRow![9]).toBe("order-002");
    expect(files["bon_referenzen.csv"]).toContain("Stornierung");
  });

  it("exports normal beleg with BON_STORNO=0 and positive amounts", () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    const row = findTransactionRow(files["transactions.csv"], "order-001");

    expect(row).toBeDefined();
    expect(row![4]).toBe("Beleg");
    expect(row![5]).toBe("Kassenbeleg");
    expect(row![7]).toBe("0");
    expect(row![12]).toBe("24.00");
    expect(row![13]).toBe("20.17");
  });

  it("keeps TSE_PROCESSTYPE Kassenbeleg-V1 for signed receipts", () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    expect(files["transactions_tse.csv"]).toContain("Kassenbeleg-V1");
  });
});

describe("dsfinvk export files", () => {
  it("builds all 11 CSV files with BOM, semicolons, and CRLF", () => {
    const files = buildDsfinvkCsvFiles(sampleContext());
    expect(Object.keys(files).sort()).toEqual([
      "bon_referenzen.csv",
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

    expect(files["transactions.csv"]).not.toMatch(/;Storno;/);
    expect(files["transactions_tse.csv"]).toContain("TSS-SN-001");
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
      "bon_referenzen.csv",
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
