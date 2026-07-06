import { describe, expect, it } from "vitest";
import {
  entriesForDayClose,
  entriesWithExpiredRetention,
  getMemoryLevel,
} from "@/lib/denis/memory/memory-registry";

describe("memory-registry", () => {
  it("resolves the registered tier for a known table", () => {
    expect(getMemoryLevel("station_question_turns")).toBe("shift");
  });

  it("returns null for a table not yet registered", () => {
    expect(getMemoryLevel("some_unregistered_table")).toBeNull();
  });

  it("includes shift-tier entries in the Day Close sweep", () => {
    const entries = entriesForDayClose();
    expect(entries.some((entry) => entry.table === "station_question_turns")).toBe(
      true
    );
    expect(entries.every((entry) => entry.dayClose !== "keep")).toBe(true);
  });

  it("includes non-audit entries with a declared retention window", () => {
    const entries = entriesWithExpiredRetention();
    expect(entries.some((entry) => entry.table === "station_question_turns")).toBe(
      true
    );
    expect(entries.every((entry) => entry.tier !== "audit")).toBe(true);
    expect(entries.every((entry) => entry.retentionDays != null)).toBe(true);
  });
});
