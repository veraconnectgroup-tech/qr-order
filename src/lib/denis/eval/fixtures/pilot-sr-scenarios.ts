import type { DenisEvalScenario } from "@/lib/denis/eval/types";

function line(productId: string, productName: string, menuSection: string) {
  return {
    productId,
    productName,
    quantity: 1,
    serveSize: null as string | null,
    modifierIds: [] as string[],
    notes: "",
    lineTotal: 8,
    menuSection,
  };
}

/**
 * ADR-019 G3 — Serbian pilot gate scenarios (kernel, no LLM).
 * Must pass before `table_os_pilot` preset on a venue.
 */
export const DENIS_PILOT_SR_SCENARIOS: DenisEvalScenario[] = [
  {
    id: "sr_seated_welcome",
    description: "Guest at table on welcome — GUEST_SEATED, not reservation desk",
    message: "zdravo, već sam za stolom",
    flowNodeId: "welcome",
    expect: {
      topGoal: "GUEST_SEATED",
    },
  },
  {
    id: "sr_seated_wants_drinks",
    description: "Guest already seated wants to order drinks at collect",
    message: "već sedim za stolom, hoću da poručim piće",
    flowNodeId: "collect",
    expect: {
      topGoal: "COMPLETE_ROUND",
    },
  },
  {
    id: "sr_confirm_pošalji",
    description: "Explicit SR confirm advances to submit skill",
    message: "da, pošalji",
    flowNodeId: "recap",
    aiCartItems: [line("p-mojito", "Mojito", "drinks")],
    expect: {
      usedT0: true,
      intent: "CONFIRM",
      flowNodeId: "submit",
      skillIds: ["order.submit"],
      allowR5: true,
    },
  },
  {
    id: "sr_confirm_da",
    description: "Short SR confirm at recap",
    message: "da",
    flowNodeId: "recap",
    aiCartItems: [line("p-mojito", "Mojito", "drinks")],
    expect: {
      usedT0: true,
      intent: "CONFIRM",
      flowNodeId: "submit",
      skillIds: ["order.submit"],
      allowR5: true,
    },
  },
  {
    id: "sr_remove_reflex",
    description: "SR remove line from cart (T0 correction)",
    message: "ukloni mojito",
    flowNodeId: "collect",
    aiCartItems: [line("p-mojito", "Mojito", "drinks")],
    expect: {
      usedT0: true,
      skillIds: ["cart.remove"],
    },
  },
];
