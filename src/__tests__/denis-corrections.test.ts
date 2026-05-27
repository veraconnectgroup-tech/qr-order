import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  type DenisCartLine,
  type DenisCartState,
} from "@/lib/denis/kernel/cart-projection";
import { applyCorrectionCommand } from "@/lib/denis/kernel/correction-protocol";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  isT0Confirm,
  isT0Done,
  resolveT0Reflex,
} from "@/lib/denis/kernel/reflex-rules";

function colaLine(): DenisCartLine {
  return {
    productId: "cola-zero",
    productName: "Cola Zero",
    quantity: 1,
    modifierIds: [],
    serveSize: "0.3L",
    notes: "",
    lineTotal: 4.5,
    menuSection: "drinks",
  };
}

function stateWithCola(): DenisCartState {
  return {
    draft: {
      cartRevision: 1,
      items: [colaLine()],
    },
    undoStack: [],
  };
}

describe("T0 reflex M4", () => {
  it("detects confirm and done without LLM", () => {
    expect(isT0Confirm("da")).toBe(true);
    expect(isT0Done("ne to je sve")).toBe(true);
    expect(resolveT0Reflex("da")?.intent).toBe("CONFIRM");
    expect(resolveT0Reflex("ne to je sve")?.tier).toBe("T0");
  });

  it("detects correction phrases", () => {
    expect(resolveT0Reflex("ne ipak pivo")?.correction?.kind).toBe("CORRECT");
    expect(resolveT0Reflex("ukloni colu")?.correction?.kind).toBe("REMOVE");
    expect(resolveT0Reflex("još jednu")?.correction?.kind).toBe("ADD_MORE");
  });
});

describe("correction protocol M4", () => {
  it("removes line by name", () => {
    const result = applyCorrectionCommand(stateWithCola(), {
      kind: "REMOVE",
      targetName: "cola",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.draft.items).toHaveLength(0);
      expect(result.state.undoStack).toHaveLength(1);
    }
  });

  it("increments last line on add_more", () => {
    const result = applyCorrectionCommand(stateWithCola(), {
      kind: "ADD_MORE",
      targetName: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.draft.items[0]?.quantity).toBe(2);
    }
  });

  it("undoes last mutation", () => {
    const removed = applyCorrectionCommand(stateWithCola(), {
      kind: "REMOVE",
      targetName: "cola",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;

    const undone = applyCorrectionCommand(removed.state, { kind: "UNDO" });
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.state.draft.items).toHaveLength(1);
    }
  });

  it("storniraj removes last line", () => {
    const result = applyCorrectionCommand(stateWithCola(), {
      kind: "CORRECT",
      targetName: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.draft.items).toHaveLength(0);
    }
  });
});

describe("planTurnWithReflex M4", () => {
  it("uses T0 done signal for flow plan", () => {
    const result = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "to je sve",
      flowNodeId: "collect",
      cartState: stateWithCola(),
    });
    expect(result.usedT0).toBe(true);
    expect(result.plan.primarySignal).toBe("DONE");
    expect(result.plan.transition.toNodeId).toBe("recap");
  });

  it("applies remove correction before planning", () => {
    const result = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "ukloni colu",
      flowNodeId: "collect",
      cartState: stateWithCola(),
    });
    expect(result.correction?.ok).toBe(true);
    expect(result.cartState.draft.items).toHaveLength(0);
  });
});

describe("undo stack depth", () => {
  it("caps undo stack at 5 entries", () => {
    let state = stateWithCola();
    for (let i = 0; i < 7; i++) {
      const add = applyCorrectionCommand(state, {
        kind: "ADD_MORE",
        targetName: null,
      });
      if (!add.ok) break;
      state = add.state;
    }
    expect(state.undoStack.length).toBeLessThanOrEqual(5);
  });
});
