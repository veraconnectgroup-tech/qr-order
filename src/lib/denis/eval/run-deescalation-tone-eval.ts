import { assessDeescalationTone } from "@/lib/denis/cognition/perceive/assess-deescalation-tone";
import {
  DEESCALATION_SCENARIOS,
  type DeescalationScenario,
} from "@/lib/denis/eval/fixtures/deescalation/scenarios";

/**
 * Pass bar: 7/10 on every axis, not 5 and not 9.
 *  - 5 (a coin-flip "meh") is too permissive for a safety-relevant surface —
 *    a de-escalation reminder that merely doesn't make things *worse* isn't
 *    good enough; it has to actually read as calm and clear.
 *  - 9 is a near-perfect bar that would make small, harmless LLM-judge
 *    scoring noise (a strict judge shaving a point off an objectively fine
 *    reply) fail the suite — that's a flaky gate, not a quality gate.
 *  - 7 asks for "clearly good, minor stylistic nitpicks allowed" without
 *    tolerating a reply that's ambiguous, cold, or borderline preachy.
 */
export const DEESCALATION_MIN_AXIS_SCORE = 7;

export type DeescalationScenarioResult = {
  id: string;
  description: string;
  passed: boolean;
  errors: string[];
  assessment: Awaited<ReturnType<typeof assessDeescalationTone>>;
};

export type DeescalationToneReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  /** How many scenarios could not be judged (no OpenAI key / judge failure) — never silently counted as a pass. */
  unjudged: number;
  results: DeescalationScenarioResult[];
};

async function runDeescalationScenario(
  scenario: DeescalationScenario
): Promise<DeescalationScenarioResult> {
  const errors: string[] = [];
  const assessment = await assessDeescalationTone({
    guestMessage: scenario.guestMessage,
    denisReply: scenario.denisReply,
    tier: scenario.tier,
  });

  if (!assessment) {
    return {
      id: scenario.id,
      description: scenario.description,
      passed: false,
      errors: ["judge unavailable (no OpenAI key configured, or judge call failed)"],
      assessment: null,
    };
  }

  if (assessment.deescalatesScore < DEESCALATION_MIN_AXIS_SCORE) {
    errors.push(
      `deescalatesScore ${assessment.deescalatesScore} below bar ${DEESCALATION_MIN_AXIS_SCORE}: ${assessment.critique}`
    );
  }
  if (assessment.boundaryClearScore < DEESCALATION_MIN_AXIS_SCORE) {
    errors.push(
      `boundaryClearScore ${assessment.boundaryClearScore} below bar ${DEESCALATION_MIN_AXIS_SCORE}: ${assessment.critique}`
    );
  }
  if (assessment.professionalToneScore < DEESCALATION_MIN_AXIS_SCORE) {
    errors.push(
      `professionalToneScore ${assessment.professionalToneScore} below bar ${DEESCALATION_MIN_AXIS_SCORE}: ${assessment.critique}`
    );
  }
  if (assessment.submissive) {
    errors.push(`judged submissive: ${assessment.critique}`);
  }

  return {
    id: scenario.id,
    description: scenario.description,
    passed: errors.length === 0,
    errors,
    assessment,
  };
}

/** Sequential (not Promise.all) — deterministic ordering for scripted-mock tests, and it's a small fixture set. */
export async function runDeescalationToneEval(): Promise<DeescalationToneReport> {
  const results: DeescalationScenarioResult[] = [];
  for (const scenario of DEESCALATION_SCENARIOS) {
    results.push(await runDeescalationScenario(scenario));
  }

  const passed = results.filter((row) => row.passed).length;
  const unjudged = results.filter((row) => row.assessment === null).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0 && results.length > 0,
    scenarioCount: results.length,
    passed,
    failed,
    unjudged,
    results,
  };
}
