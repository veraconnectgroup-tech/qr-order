import type { DenisEvalScenario } from "@/lib/denis/eval/types";
import {
  appendProductionEdgeCasesFromLearnings,
  loadProductionEdgeCases,
} from "@/lib/denis/eval/fixtures/production-edge-case-store";
import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";
import type { UnknownIntentEdgeCase } from "@/lib/admin/denis-insights-aggregate";

export function unknownIntentToEvalScenario(
  edgeCase: UnknownIntentEdgeCase
): DenisEvalScenario {
  const slug = edgeCase.guestText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");

  return {
    id: `admin_review_${edgeCase.sessionId.slice(0, 8)}_${slug || "unknown"}`,
    description: `Admin-reviewed unknown intent: ${edgeCase.guestText.slice(0, 80)}`,
    message: edgeCase.guestText,
    flowNodeId: "welcome",
    expect: {
      usedT0: false,
    },
  };
}

export function edgeCaseToLearning(
  edgeCase: UnknownIntentEdgeCase
): ExtractedLearning {
  return {
    id: edgeCase.id,
    kind: "mismatch",
    guestMessage: edgeCase.guestText,
    denisResponse: edgeCase.denisResponse ?? undefined,
    sessionId: edgeCase.sessionId,
    capturedAt: edgeCase.capturedAt,
    confidence: 0.9,
  };
}

/** Promote admin-reviewed unknown intent to auto-growing eval fixture store. */
export async function promoteUnknownIntentToEvalFixture(
  edgeCase: UnknownIntentEdgeCase
): Promise<{ ok: boolean; scenarioId: string; appended: number }> {
  const learning = edgeCaseToLearning(edgeCase);
  const appended = await appendProductionEdgeCasesFromLearnings([learning]);
  return {
    ok: true,
    scenarioId: unknownIntentToEvalScenario(edgeCase).id,
    appended,
  };
}

export async function listEvalEdgeCaseCount(): Promise<number> {
  const cases = await loadProductionEdgeCases();
  return cases.length;
}
