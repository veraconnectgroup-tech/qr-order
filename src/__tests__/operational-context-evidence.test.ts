import { describe, expect, it } from "vitest";
import { retrieveOperationalContextEvidence } from "@/lib/denis/cognition/context/retrievers/operational-context-evidence";
import type { GuestTurnOperationalContext } from "@/lib/denis/cognition/context/assemble-operational-context";

describe("retrieveOperationalContextEvidence", () => {
  it("emits nothing when there is no correlated note", () => {
    const ctx: GuestTurnOperationalContext = {
      stations: { kitchen: null, bar: null },
      guestFrustration: null,
      correlatedNote: null,
    };
    expect(retrieveOperationalContextEvidence(ctx)).toBe("");
  });

  it("emits nothing when the context itself is missing", () => {
    expect(retrieveOperationalContextEvidence(null)).toBe("");
    expect(retrieveOperationalContextEvidence(undefined)).toBe("");
  });

  it("emits the correlated note under an OPERATIONAL CONTEXT header", () => {
    const ctx: GuestTurnOperationalContext = {
      stations: { kitchen: null, bar: null },
      guestFrustration: { level: "mild", signals: [] },
      correlatedNote: "kitchen (busy) is running behind while this guest's frustration reads mild.",
    };
    const result = retrieveOperationalContextEvidence(ctx);
    expect(result).toMatch(/^OPERATIONAL CONTEXT:/);
    expect(result).toContain(ctx.correlatedNote);
  });
});
