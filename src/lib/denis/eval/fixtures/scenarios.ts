import type { DenisEvalScenario } from "@/lib/denis/eval/types";

function line(
  productId: string,
  productName: string,
  menuSection: string
) {
  return {
    productId,
    productName,
    quantity: 1,
    serveSize: null as string | null,
    modifierIds: [] as string[],
    notes: "",
    lineTotal: 4,
    menuSection,
  };
}

/** Golden scenarios — ADR-005 fixtures (M10). */
export const DENIS_EVAL_SCENARIOS: DenisEvalScenario[] = [
  {
    id: "cola_conflict",
    description: "Manual cart vs AI draft triggers RECONCILE_CART",
    message: "hello",
    flowNodeId: "recap",
    aiCartItems: [line("p-espresso", "Espresso", "drinks")],
    manualCartItems: [line("p-cola", "Cola Zero", "drinks")],
    expect: {
      topGoal: "RECONCILE_CART",
      hasConflict: true,
    },
  },
  {
    id: "t0_confirm",
    description: "T0 confirm reflex without LLM",
    message: "da",
    flowNodeId: "recap",
    expect: {
      usedT0: true,
      intent: "CONFIRM",
      allowR5: true,
    },
  },
  {
    id: "drinks_upsell_guard",
    description: "Drinks-only cart enters food upsell flow node",
    message: "hi",
    flowNodeId: "collect",
    aiCartItems: [line("p-beer", "Craft IPA", "drinks")],
    expect: {
      flowNodeId: "upsell_food",
    },
  },
  {
    id: "cart_remove_reflex",
    description: "T0 remove correction skill",
    message: "ukloni colu",
    flowNodeId: "collect",
    aiCartItems: [line("p-cola", "Cola Zero", "drinks")],
    expect: {
      usedT0: true,
      skillIds: ["cart.remove"],
    },
  },
  {
    id: "recap_complete_round",
    description: "Recap node prioritizes COMPLETE_ROUND when carts align",
    message: "hello",
    flowNodeId: "recap",
    aiCartItems: [line("p-beer", "Craft IPA", "drinks")],
    expect: {
      topGoal: "COMPLETE_ROUND",
      hasConflict: false,
    },
  },
];
