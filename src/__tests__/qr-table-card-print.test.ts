import { describe, expect, it } from "vitest";
import {
  buildQrTableCardPrintHtml,
  escapeHtml,
  formatTableLabel,
  resolveQrTableCardLocale,
} from "@/lib/print/qr-table-card-print";

describe("qr-table-card-print", () => {
  it("escapes HTML in user-provided strings", () => {
    expect(escapeHtml(`Tom & "Jerry" <script>`)).toBe(
      "Tom &amp; &quot;Jerry&quot; &lt;script&gt;"
    );
  });

  it("formats table label with zone fallback", () => {
    expect(formatTableLabel("Table 12", null, "de")).toBe(
      "Table 12 · Ohne Bereich"
    );
    expect(formatTableLabel("Table 12", "Rooftop", "en")).toBe(
      "Table 12 · Rooftop"
    );
  });

  it("resolves print locale from menu locale", () => {
    expect(resolveQrTableCardLocale("en")).toBe("en");
    expect(resolveQrTableCardLocale("de")).toBe("de");
    expect(resolveQrTableCardLocale("sr")).toBe("de");
  });

  it("builds branded print HTML without QR Order copy", () => {
    const html = buildQrTableCardPrintHtml({
      venueName: "Skyline Lounge",
      locale: "de",
      items: [
        {
          tableName: "T12",
          zoneName: "Rooftop",
          scanUrl: "https://example.com/slug/token",
          qrDataUrl: "data:image/png;base64,abc",
        },
      ],
    });

    expect(html).toContain("Skyline Lounge — Tischbestellung");
    expect(html).toContain("T12 · Rooftop");
    expect(html).toContain("Scannen zum Bestellen &amp; Bezahlen");
    expect(html).toContain("Denis · Part of Vera Group");
    expect(html).toContain('stroke="#f97316"');
    expect(html).not.toContain("QR Order");
  });
});
