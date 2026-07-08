import { describe, expect, it } from "vitest";
import {
  entriesForDayClose,
  entriesWithExpiredRetention,
  getMemoryLevel,
  MEMORY_REGISTRY_FOR_TESTS,
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

  // ADR-045 S1 asks for "a lint/test that keeps the registry up to date" —
  // these are cheap invariants, not full coverage enforcement.
  it("registers every table exactly once", () => {
    const tables = MEMORY_REGISTRY_FOR_TESTS.map((entry) => entry.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("gives every PII-flagged entry a non-trivial explanatory note", () => {
    for (const entry of MEMORY_REGISTRY_FOR_TESTS) {
      if (entry.pii) {
        expect(entry.notes.length).toBeGreaterThan(20);
      }
    }
  });

  it("only lets audit/restaurant-tier (permanent by design) have a null retention", () => {
    for (const entry of MEMORY_REGISTRY_FOR_TESTS) {
      if (entry.retentionDays == null && entry.tier !== "audit" && entry.tier !== "restaurant") {
        throw new Error(
          `Unexpected null retention on ${entry.table} (${entry.tier}) — set retentionDays or move to audit/restaurant tier`
        );
      }
    }
  });
});
