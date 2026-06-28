import { describe, expect, it } from "vitest";
import { generateBrandedQrDataUrl } from "@/lib/qr/branded-qr";
import {
  A4_QR_PRINT_LAYOUT,
  buildQrPrintPdf,
  countPdfPages,
  isValidPdfBuffer,
} from "@/lib/qr/qr-print-pdf";

describe("buildQrPrintPdf", () => {
  it("generates a valid PDF with six cards per page", async () => {
    const cards = Array.from({ length: 7 }, (_, index) => ({
      tableName: `Table ${index + 1}`,
      venueName: "Skyline Lounge",
      scanUrl: `https://denis.app/demo/table-${index + 1}`,
      brandColor: "#f97316",
    }));

    const pdf = await buildQrPrintPdf(cards, A4_QR_PRINT_LAYOUT);

    expect(isValidPdfBuffer(pdf)).toBe(true);
    expect(countPdfPages(pdf)).toBe(2);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("embeds branded QR data for each table card", async () => {
    const pdf = await buildQrPrintPdf([
      {
        tableName: "T1",
        venueName: "Demo Bistro",
        scanUrl: "https://denis.app/demo/t1",
        brandColor: "#2563eb",
      },
    ]);

    const body = pdf.toString("latin1");
    expect(isValidPdfBuffer(pdf)).toBe(true);
    expect(body).toContain("Demo Bistro");
    expect(body).toContain("T1");
  });
});

describe("generateBrandedQrDataUrl", () => {
  it("returns a PNG data URL with brand color in node", async () => {
    const dataUrl = await generateBrandedQrDataUrl({
      scanUrl: "https://denis.app/demo/table-1",
      brandColor: "#2563eb",
      width: 160,
    });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});
