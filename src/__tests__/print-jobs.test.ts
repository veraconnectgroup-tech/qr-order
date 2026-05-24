import { describe, expect, it } from "vitest";
import {
  decodePrintPayload,
  encodePrintPayload,
  normalizePrinterMac,
} from "@/lib/printer/print-jobs";

describe("print-jobs", () => {
  it("normalizes MAC addresses", () => {
    expect(normalizePrinterMac("aa-bb-cc-dd-ee-ff")).toBe(
      "AA:BB:CC:DD:EE:FF"
    );
    expect(normalizePrinterMac("AABBCCDDEEFF")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("round-trips bytea payloads", () => {
    const original = new Uint8Array([0x1b, 0x40, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const encoded = encodePrintPayload(original);
    expect(encoded.startsWith("\\x")).toBe(true);
    expect(decodePrintPayload(encoded)).toEqual(original);
  });
});
