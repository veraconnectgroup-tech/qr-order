import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import {
  detectCartConflicts,
  hasCartConflicts,
  resolveCartConflict,
} from "@/lib/denis/kernel/conflict";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { topGoal } from "@/lib/denis/kernel/goal-stack";

function line(
  partial: Partial<DenisCartLine> & Pick<DenisCartLine, "productId" | "productName">
): DenisCartLine {
  return {
    quantity: 1,
    serveSize: null,
    modifierIds: [],
    notes: "",
    lineTotal: 4,
    menuSection: "drinks",
    ...partial,
  };
}

describe("conflict detect M6", () => {
  it("detects ai_only and manual_only", () => {
    const conflicts = detectCartConflicts(
      { items: [line({ productId: "espresso", productName: "Espresso" })], cartRevision: 1 },
      { items: [line({ productId: "cola", productName: "Cola Zero", lineTotal: 4 })], cartRevision: 1 }
    );
    expect(conflicts.some((c) => c.kind === "ai_only")).toBe(true);
    expect(conflicts.some((c) => c.kind === "manual_only")).toBe(true);
  });

  it("detects duplicate_line quantity mismatch", () => {
    const conflicts = detectCartConflicts(
      {
        items: [line({ productId: "cola", productName: "Cola Zero", quantity: 2, lineTotal: 8 })],
        cartRevision: 1,
      },
      {
        items: [line({ productId: "cola", productName: "Cola Zero", quantity: 1, lineTotal: 4 })],
        cartRevision: 1,
      }
    );
    expect(conflicts.some((c) => c.kind === "duplicate_line")).toBe(true);
  });

  it("returns no conflict when carts match", () => {
    const draft = {
      items: [line({ productId: "cola", productName: "Cola Zero" })],
      cartRevision: 1,
    };
    expect(hasCartConflicts(draft, draft)).toBe(false);
  });
});

describe("conflict resolve M6", () => {
  it("offers merge recap when manualCart enabled", () => {
    const resolution = resolveCartConflict({
      ai: { items: [line({ productId: "espresso", productName: "Espresso" })], cartRevision: 1 },
      manual: { items: [line({ productId: "cola", productName: "Cola Zero" })], cartRevision: 1 },
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });
    expect(resolution.strategy).toBe("offer_merge_recap");
    expect(resolution.hasConflict).toBe(true);
    expect(resolution.guestPrompt).toContain("Cola Zero");
    expect(resolution.guestPrompt).toContain("Espresso");
    expect(resolution.unifiedView.proposedMerge).toHaveLength(2);
  });

  it("prefers AI when manualCart disabled", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      context: { ...CONCIERGE_PLATFORM_DEFAULTS.context, manualCart: false },
    };
    const resolution = resolveCartConflict({
      ai: { items: [line({ productId: "espresso", productName: "Espresso" })], cartRevision: 1 },
      manual: { items: [line({ productId: "cola", productName: "Cola Zero" })], cartRevision: 1 },
      config,
    });
    expect(resolution.strategy).toBe("prefer_ai_for_submit");
    expect(resolution.guestPrompt).toBeNull();
  });
});

describe("reflex-plan M6 integration", () => {
  it("elevates RECONCILE_CART when manual cart diverges", () => {
    const result = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "hello",
      flowNodeId: "recap",
      manualCartDraft: {
        items: [line({ productId: "cola", productName: "Cola Zero" })],
        cartRevision: 1,
      },
      cartState: {
        draft: {
          items: [line({ productId: "espresso", productName: "Espresso" })],
          cartRevision: 1,
        },
        undoStack: [],
      },
    });
    expect(result.conflict?.hasConflict).toBe(true);
    expect(topGoal(result.plan.goals)?.type).toBe("RECONCILE_CART");
  });
});
