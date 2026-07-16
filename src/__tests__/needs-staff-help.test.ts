import { describe, expect, it } from "vitest";
import { shouldEscalateNeedsStaffHelp } from "@/lib/denis/runtime/resolve-needs-staff-help-escalation";
import { parseAiStructuredResponse } from "@/lib/ai/parse-response";

describe("shouldEscalateNeedsStaffHelp — founder's 'find a way' directive", () => {
  const base = {
    needsStaffHelp: "Gost traži salvete i escajg" as string | null | undefined,
    handoffCommandType: null as string | null | undefined,
    waiterCallEnabled: true,
    liveExecutionEnabled: true,
    tableId: "table-1" as string | null | undefined,
    locationId: "loc-1" as string | null | undefined,
  };

  it("escalates when the LLM perceived a genuine capability gap", () => {
    expect(shouldEscalateNeedsStaffHelp(base)).toBe(true);
  });

  it("does not escalate when there is nothing to relay", () => {
    expect(
      shouldEscalateNeedsStaffHelp({ ...base, needsStaffHelp: null })
    ).toBe(false);
  });

  it("skips a redundant second call — T0 already fired a real WAITER.REQUEST this turn", () => {
    expect(
      shouldEscalateNeedsStaffHelp({
        ...base,
        handoffCommandType: "WAITER.REQUEST",
      })
    ).toBe(false);
  });

  it("still escalates alongside a DIFFERENT T0 handoff this turn (e.g. bill request) — orthogonal concerns", () => {
    expect(
      shouldEscalateNeedsStaffHelp({
        ...base,
        handoffCommandType: "BILL.REQUEST",
      })
    ).toBe(true);
  });

  it("respects the waiterCall config switch", () => {
    expect(
      shouldEscalateNeedsStaffHelp({ ...base, waiterCallEnabled: false })
    ).toBe(false);
  });

  it("respects the liveExecution config switch", () => {
    expect(
      shouldEscalateNeedsStaffHelp({ ...base, liveExecutionEnabled: false })
    ).toBe(false);
  });

  it("never escalates without table/location context", () => {
    expect(shouldEscalateNeedsStaffHelp({ ...base, tableId: null })).toBe(
      false
    );
    expect(shouldEscalateNeedsStaffHelp({ ...base, locationId: null })).toBe(
      false
    );
  });
});

describe("parseAiStructuredResponse — needsStaffHelp field", () => {
  const productMap = {};

  it("parses a set needsStaffHelp reason", () => {
    const raw = JSON.stringify({
      message: "Javljam osoblju.",
      needsStaffHelp: "Gost traži dodatne salvete",
    });
    const { structured } = parseAiStructuredResponse(raw, productMap);
    expect(structured.needsStaffHelp).toBe("Gost traži dodatne salvete");
  });

  it("defaults to null when the LLM omits the field entirely", () => {
    const raw = JSON.stringify({ message: "Naravno, evo menija." });
    const { structured } = parseAiStructuredResponse(raw, productMap);
    expect(structured.needsStaffHelp).toBeNull();
  });

  it("defaults to null when the LLM explicitly sends null", () => {
    const raw = JSON.stringify({
      message: "Naravno.",
      needsStaffHelp: null,
    });
    const { structured } = parseAiStructuredResponse(raw, productMap);
    expect(structured.needsStaffHelp).toBeNull();
  });
});
