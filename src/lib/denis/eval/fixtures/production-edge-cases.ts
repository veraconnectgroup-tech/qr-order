import type { DenisEvalScenario } from "@/lib/denis/eval/types";
import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";

/** Baseline production-derived edge cases (seed; auto-store appends at runtime). */
export const PRODUCTION_EDGE_CASE_SEED: DenisEvalScenario[] = [
  {
    id: "prod_edge_vegan_clarify",
    description: "Guest asks vegan — reflex enters seated welcome flow",
    message: "Imate li nešto vegansko?",
    flowNodeId: "welcome",
    expect: {
      topGoal: "GUEST_SEATED",
    },
  },
  {
    id: "prod_edge_remove_cola",
    description: "Guest removes item after misunderstanding",
    message: "ukloni colu",
    flowNodeId: "collect",
    aiCartItems: [
      {
        productId: "p-cola",
        productName: "Cola Zero",
        quantity: 1,
        serveSize: null,
        modifierIds: [],
        notes: "",
        lineTotal: 4,
        menuSection: "drinks",
      },
    ],
    expect: {
      usedT0: true,
    },
  },
];

export function learningToEvalScenario(
  learning: ExtractedLearning,
  index: number
): DenisEvalScenario | null {
  if (learning.kind !== "mismatch" && learning.kind !== "correction") {
    return null;
  }

  const slug = learning.guestMessage
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");

  return {
    id: `prod_auto_${learning.sessionId.slice(0, 8)}_${index}_${slug || "edge"}`,
    description: `Production ${learning.kind}: ${learning.guestMessage.slice(0, 80)}`,
    message: learning.guestMessage,
    flowNodeId: "welcome",
    expect: {
      usedT0: learning.kind === "correction",
    },
  };
}

export function mergeProductionEdgeCases(
  dynamic: DenisEvalScenario[]
): DenisEvalScenario[] {
  const byId = new Map<string, DenisEvalScenario>();
  for (const scenario of PRODUCTION_EDGE_CASE_SEED) {
    byId.set(scenario.id, scenario);
  }
  for (const scenario of dynamic) {
    byId.set(scenario.id, scenario);
  }
  return [...byId.values()];
}
