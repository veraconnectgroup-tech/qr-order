import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import type { DenisEvalScenario } from "@/lib/denis/eval/types";
import { evaluateExperiment, type Experiment } from "@/lib/denis/experiments/live-ab";

export const PROMPT_LEARNING_THRESHOLD = 50;

export type PromptVariantEval = {
  section: string;
  learningCoverage: number;
  edgePassRate: number;
  compositeScore: number;
};

export type PromptAbEvalResult = {
  variantA: PromptVariantEval;
  variantB: PromptVariantEval;
  winner: "A" | "B" | "inconclusive";
  confidence: number;
  lift: number;
  recommendation: string;
};

const PROMPT_AB_EXPERIMENT: Experiment = {
  id: "prompt-evolution-ab",
  metric: "conversion_rate",
  variantA: {},
  variantB: {},
  trafficSplit: 0.5,
  minSessions: 50,
  startedAt: "2026-01-01T00:00:00.000Z",
  status: "running",
};

function learningRuleLine(learning: ExtractedLearning): string {
  switch (learning.kind) {
    case "correction":
      return `- When guest says "${learning.guestMessage.slice(0, 120)}", do NOT repeat "${(learning.denisResponse ?? "").slice(0, 80)}"${learning.correctedTo ? `; prefer "${learning.correctedTo.slice(0, 80)}"` : ""}.`;
    case "mismatch":
      return `- If guest asks "${learning.guestMessage.slice(0, 120)}", address their exact request before upselling.`;
    case "waiter_failure":
      return `- After "${(learning.denisResponse ?? "").slice(0, 80)}", guest asked for staff — clarify faster and offer human handoff when stuck.`;
    case "reinforcement":
      return `- Reinforce successful pattern: guest confirmed "${learning.guestMessage.slice(0, 60)}" after "${(learning.denisResponse ?? "").slice(0, 60)}".`;
    default:
      return "";
  }
}

/** Build an evolved system-prompt section once enough learnings accumulate. */
export function generateEvolvedPromptSection(
  learnings: ExtractedLearning[]
): string | null {
  if (learnings.length < PROMPT_LEARNING_THRESHOLD) return null;

  const prioritized = [...learnings].sort((a, b) => b.confidence - a.confidence);
  const rules = prioritized
    .map(learningRuleLine)
    .filter(Boolean)
    .slice(0, 60);

  return [
    "## Auto-evolved session learnings",
    "Apply these venue-specific corrections learned from production sessions:",
    ...rules,
  ].join("\n");
}

function measureLearningCoverage(
  section: string,
  learnings: ExtractedLearning[]
): number {
  if (!learnings.length) return 1;
  if (!section.trim()) return 0;

  const normalized = section.toLowerCase();
  let covered = 0;

  for (const learning of learnings) {
    const anchor = learning.guestMessage.slice(0, 24).toLowerCase();
    if (anchor.length >= 4 && normalized.includes(anchor)) {
      covered += 1;
      continue;
    }
    if (
      learning.correctedTo &&
      normalized.includes(learning.correctedTo.slice(0, 24).toLowerCase())
    ) {
      covered += 1;
    }
  }

  return covered / learnings.length;
}

function measureEdgePassRate(scenarios: DenisEvalScenario[]): number {
  if (!scenarios.length) return 1;
  const passed = scenarios.filter((scenario) => runDenisScenario(scenario).passed)
    .length;
  return passed / scenarios.length;
}

function compositePromptScore(
  learningCoverage: number,
  edgePassRate: number
): number {
  return learningCoverage * 0.55 + edgePassRate * 0.45;
}

function evaluateVariant(
  section: string,
  learnings: ExtractedLearning[],
  edgeScenarios: DenisEvalScenario[]
): PromptVariantEval {
  const learningCoverage = measureLearningCoverage(section, learnings);
  const edgePassRate = measureEdgePassRate(edgeScenarios);
  return {
    section,
    learningCoverage,
    edgePassRate,
    compositeScore: compositePromptScore(learningCoverage, edgePassRate),
  };
}

/** A/B: baseline prompt section vs evolved section on edge-case fixtures. */
export function evaluatePromptAbTest(input: {
  baselineSection: string;
  evolvedSection: string;
  learnings: ExtractedLearning[];
  edgeScenarios: DenisEvalScenario[];
}): PromptAbEvalResult {
  const variantA = evaluateVariant(
    input.baselineSection,
    input.learnings,
    input.edgeScenarios
  );
  const variantB = evaluateVariant(
    input.evolvedSection,
    input.learnings,
    input.edgeScenarios
  );

  const sessionsA = Math.round(variantA.compositeScore * 100);
  const sessionsB = Math.round(variantB.compositeScore * 100);
  const ab = evaluateExperiment(
    PROMPT_AB_EXPERIMENT,
    Array.from({ length: sessionsA }, (_, index) => ({
      sessionToken: `prompt-a-${index}`,
      converted: index < Math.round(sessionsA * variantA.edgePassRate),
      orderValueCents: 0,
      upsellAccepted: false,
      minutesToFirstOrder: null,
    })),
    Array.from({ length: sessionsB }, (_, index) => ({
      sessionToken: `prompt-b-${index}`,
      converted: index < Math.round(sessionsB * variantB.edgePassRate),
      orderValueCents: 0,
      upsellAccepted: false,
      minutesToFirstOrder: null,
    }))
  );

  let winner: PromptAbEvalResult["winner"] = "inconclusive";
  if (variantB.compositeScore > variantA.compositeScore + 0.02) {
    winner = "B";
  } else if (variantA.compositeScore > variantB.compositeScore + 0.02) {
    winner = "A";
  }

  if (ab.winner === "B") winner = "B";
  if (ab.winner === "A") winner = "A";

  const lift =
    variantA.compositeScore === 0
      ? variantB.compositeScore
      : (variantB.compositeScore - variantA.compositeScore) /
        variantA.compositeScore;

  return {
    variantA,
    variantB,
    winner,
    confidence: ab.confidence,
    lift,
    recommendation:
      winner === "B"
        ? "Deploy evolved prompt section after admin approval."
        : winner === "A"
          ? "Keep baseline prompt; evolved section did not beat control."
          : "Continue collecting learnings before prompt promotion.",
  };
}

export function canAutoDeployPromptEvolution(
  result: PromptAbEvalResult,
  adminApproved: boolean
): boolean {
  return (
    adminApproved &&
    result.winner === "B" &&
    result.confidence >= 0.95 &&
    result.variantB.edgePassRate >= result.variantA.edgePassRate
  );
}

export function selectPromptWinner(
  result: PromptAbEvalResult
): "baseline" | "evolved" | "hold" {
  if (result.winner === "B") return "evolved";
  if (result.winner === "A") return "baseline";
  return "hold";
}
