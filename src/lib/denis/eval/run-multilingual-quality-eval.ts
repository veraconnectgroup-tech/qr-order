import { assessReplyQuality } from "@/lib/denis/cognition/perceive/assess-reply-quality";
import {
  MULTILINGUAL_QUALITY_SCENARIOS,
  type MultilingualQualityScenario,
} from "@/lib/denis/eval/fixtures/multilingual-quality/scenarios";

/**
 * Pass bar: 7/10, same reasoning as the de-escalation eval
 * (run-deescalation-tone-eval.ts) — 5 would let genuinely awkward,
 * translation-ese phrasing through; 9 would make the suite flaky on
 * harmless judge noise for what's ordinary, competent service language
 * (this is NOT a safety-critical surface like conduct de-escalation, so
 * we don't need a stricter bar than that one either).
 */
export const MULTILINGUAL_MIN_SCORE = 7;

const LANGUAGE_LABEL: Record<MultilingualQualityScenario["language"], string> = {
  fr: "French",
  es: "Spanish",
  ru: "Russian",
};

function rubricFor(language: MultilingualQualityScenario["language"]): string[] {
  return [
    `Reads as natural, fluent ${LANGUAGE_LABEL[language]} a native speaker would actually say — not a stiff or literal translation.`,
    "Grammatically correct (agreement, verb tense, word order).",
    "Register matches a friendly-but-professional restaurant server, not overly formal or overly casual.",
    "Actually answers what the guest asked, staying concise.",
  ];
}

export type MultilingualQualityResult = {
  id: string;
  language: MultilingualQualityScenario["language"];
  description: string;
  passed: boolean;
  errors: string[];
  assessment: Awaited<ReturnType<typeof assessReplyQuality>>;
};

export type MultilingualQualityReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  unjudged: number;
  results: MultilingualQualityResult[];
};

async function runOne(
  scenario: MultilingualQualityScenario
): Promise<MultilingualQualityResult> {
  const assessment = await assessReplyQuality({
    contextNote: `The guest is chatting in ${LANGUAGE_LABEL[scenario.language]} at a restaurant.`,
    rubric: rubricFor(scenario.language),
    guestOrStaffMessage: scenario.guestMessage,
    denisReply: scenario.denisReply,
  });

  if (!assessment) {
    return {
      id: scenario.id,
      language: scenario.language,
      description: scenario.description,
      passed: false,
      errors: ["judge unavailable (no OpenAI key configured, or judge call failed)"],
      assessment: null,
    };
  }

  const errors: string[] = [];
  if (assessment.score < MULTILINGUAL_MIN_SCORE) {
    errors.push(
      `score ${assessment.score} below bar ${MULTILINGUAL_MIN_SCORE}: ${assessment.critique}`
    );
  }
  if (!assessment.meetsBar) {
    errors.push(`judge did not consider this bar-meeting: ${assessment.critique}`);
  }

  return {
    id: scenario.id,
    language: scenario.language,
    description: scenario.description,
    passed: errors.length === 0,
    errors,
    assessment,
  };
}

/** Blind-spot eval #2 — non-primary-language (fr/es/ru) reply PHRASING quality, not language routing. */
export async function runMultilingualQualityEval(): Promise<MultilingualQualityReport> {
  const results: MultilingualQualityResult[] = [];
  for (const scenario of MULTILINGUAL_QUALITY_SCENARIOS) {
    results.push(await runOne(scenario));
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
