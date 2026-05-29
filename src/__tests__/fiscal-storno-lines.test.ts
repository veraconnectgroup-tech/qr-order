import { describe, expect, it } from "vitest";
import { buildFiscalStornoLines } from "@/lib/fiscal/runtime/build-fiscal-storno-lines";

describe("buildFiscalStornoLines", () => {
  const items = [
    {
      product_name: "Pizza",
      quantity: 1,
      total: 12,
      tax_rate: 19,
    },
    {
      product_name: "Cola",
      quantity: 1,
      total: 3,
      tax_rate: 19,
    },
  ];

  it("returns full lines for full storno", () => {
    const result = buildFiscalStornoLines(items, 15, 15);
    expect(result.gross_total).toBe(15);
    expect(result.lines).toHaveLength(2);
  });

  it("scales lines for partial storno", () => {
    const result = buildFiscalStornoLines(items, 7.5, 15);
    expect(result.gross_total).toBe(7.5);
    expect(result.lines[0]?.gross).toBe(6);
    expect(result.lines[1]?.gross).toBe(1.5);
  });
});
