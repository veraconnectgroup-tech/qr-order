import { describe, expect, it } from "vitest";
import { resolvePosCapabilities } from "@/lib/integrations/pos-capability-matrix";

describe("resolvePosCapabilities", () => {
  it("returns the conservative baseline for an unknown/unspecified vendor", () => {
    const caps = resolvePosCapabilities("unknown");

    expect(caps.dineInOrder.status).toBe("confirmed");
    expect(caps.prepaidFlag.status).toBe("confirmed");
    expect(caps.readOpenBill.status).toBe("not_supported");
    expect(caps.appendToOpenBill.status).toBe("not_supported");
    expect(caps.closeBill.status).toBe("not_confirmed");
  });

  it("never reports readOpenBill/appendToOpenBill/closeBill as confirmed for any researched vendor", () => {
    for (const vendor of ["toast", "lightspeed", "orderbird"] as const) {
      const caps = resolvePosCapabilities(vendor);
      expect(caps.readOpenBill.status).not.toBe("confirmed");
      expect(caps.appendToOpenBill.status).not.toBe("confirmed");
      expect(caps.closeBill.status).not.toBe("confirmed");
    }
  });

  it("applies the Toast-specific override for dineInOrder", () => {
    const caps = resolvePosCapabilities("toast");
    expect(caps.dineInOrder.status).toBe("not_confirmed");
  });

  it("applies the orderbird-specific override for floorPlanApi", () => {
    const caps = resolvePosCapabilities("orderbird");
    expect(caps.floorPlanApi.status).toBe("not_confirmed");
  });

  it("falls back to baseline for capabilities a vendor does not override", () => {
    const caps = resolvePosCapabilities("lightspeed");
    // Lightspeed has no override for tips — should inherit the baseline.
    expect(caps.tips.status).toBe("pos_dependent");
  });

  it("every capability entry carries a non-empty note", () => {
    for (const vendor of ["unknown", "toast", "lightspeed", "orderbird"] as const) {
      const caps = resolvePosCapabilities(vendor);
      for (const entry of Object.values(caps)) {
        expect(entry.note.length).toBeGreaterThan(0);
      }
    }
  });
});
