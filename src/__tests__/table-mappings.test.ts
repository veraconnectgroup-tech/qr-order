import { describe, expect, it } from "vitest";
import { parseBulkMappingText } from "@/components/admin/table-mappings-panel";

describe("parseBulkMappingText", () => {
  it("parses comma-separated rows and skips comments", () => {
    const rows = parseBulkMappingText(`
# POS, Vera
Tisch 5, Table 5
T12, Tisch 12
    `);

    expect(rows).toEqual([
      { externalTableKey: "Tisch 5", veraTableName: "Table 5" },
      { externalTableKey: "T12", veraTableName: "Tisch 12" },
    ]);
  });

  it("parses tab-separated rows", () => {
    const rows = parseBulkMappingText("Bar 1\tTisch Bar 1");
    expect(rows).toEqual([
      { externalTableKey: "Bar 1", veraTableName: "Tisch Bar 1" },
    ]);
  });
});
