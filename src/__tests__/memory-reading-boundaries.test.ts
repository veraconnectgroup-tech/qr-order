import { describe, expect, it } from "vitest";
import {
  ADR045_GUEST_TURN_FORBIDDEN_IMPORTS,
  runDenisArchitectureCompliance,
} from "@/lib/denis/architecture/compliance";
import { entriesForDayClose, MEMORY_REGISTRY_FOR_TESTS } from "@/lib/denis/memory/memory-registry";
import { AUDIT_TABLES_HARD_EXEMPT } from "@/lib/denis/memory/memory-retention";

describe("ADR-045 reading boundaries", () => {
  it("passes guest-turn audit boundary and learning PII boundary checks", () => {
    const report = runDenisArchitectureCompliance();
    const adr045Errors = report.errors.filter((issue) =>
      issue.code.startsWith("ADR045-")
    );
    expect(adr045Errors).toEqual([]);
  });

  it("documents forbidden audit imports for guest turn paths", () => {
    expect(ADR045_GUEST_TURN_FORBIDDEN_IMPORTS.length).toBeGreaterThan(0);
    expect(ADR045_GUEST_TURN_FORBIDDEN_IMPORTS).toContain(
      "@/lib/admin/load-denis-audit-trail"
    );
  });

  it("keeps audit tables out of retention sweep eligibility", () => {
    const dayCloseTables = new Set(entriesForDayClose().map((entry) => entry.table));
    for (const auditTable of AUDIT_TABLES_HARD_EXEMPT) {
      const registryEntry = MEMORY_REGISTRY_FOR_TESTS.find(
        (entry) => entry.table === auditTable
      );
      if (registryEntry) {
        expect(registryEntry.tier).toBe("audit");
        expect(registryEntry.dayClose).toBe("keep");
      }
      expect(dayCloseTables.has(auditTable)).toBe(false);
    }
  });
});
