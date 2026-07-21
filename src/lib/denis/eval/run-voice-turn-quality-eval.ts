import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { assessReplyQuality } from "@/lib/denis/cognition/perceive/assess-reply-quality";
import { interpretStationVoiceTurn } from "@/lib/denis/stations/interpret-station-voice-turn";
import {
  VOICE_TURN_QUALITY_SCENARIOS,
  type VoiceTurnQualityScenario,
} from "@/lib/denis/eval/fixtures/voice-turn-quality/scenarios";

/** Same 7/10 reasoning as the other two phrasing-quality evals in this batch. */
export const VOICE_TURN_MIN_SCORE = 7;

const RUBRIC = [
  "Concise — 1-2 short sentences max, nothing a cook mid-service would have to stop and parse.",
  "Actionable/clear — the cook immediately knows what Denis heard and what happens next.",
  "No fluff — no filler pleasantries, no robotic command-menu phrasing.",
  "Natural spoken Serbian a real colleague would say out loud, not written-report style.",
];

export type VoiceTurnQualityResult = {
  id: string;
  description: string;
  passed: boolean;
  errors: string[];
  speak: string;
  assessment: Awaited<ReturnType<typeof assessReplyQuality>>;
};

export type VoiceTurnQualityReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  unjudged: number;
  results: VoiceTurnQualityResult[];
};

async function runOne(
  scenario: VoiceTurnQualityScenario
): Promise<VoiceTurnQualityResult> {
  const turnResult = await interpretStationVoiceTurn(
    {
      questionMessage: scenario.questionMessage,
      questionType: scenario.questionType,
      station: scenario.station,
      staffTranscript: scenario.staffTranscript,
      priorTurns: scenario.priorTurns,
      locationId: "eval-loc-voice-turn",
    },
    CONCIERGE_PLATFORM_DEFAULTS
  );

  const assessment = await assessReplyQuality({
    contextNote:
      "Denis is on a live voice call with kitchen/bar staff who have their hands busy mid-service. This is what Denis said back after hearing the staff transcript.",
    rubric: RUBRIC,
    guestOrStaffMessage: scenario.staffTranscript,
    denisReply: turnResult.speak,
  });

  if (!assessment) {
    return {
      id: scenario.id,
      description: scenario.description,
      passed: false,
      errors: ["judge unavailable (no OpenAI key configured, or judge call failed)"],
      speak: turnResult.speak,
      assessment: null,
    };
  }

  const errors: string[] = [];
  if (assessment.score < VOICE_TURN_MIN_SCORE) {
    errors.push(
      `score ${assessment.score} below bar ${VOICE_TURN_MIN_SCORE}: ${assessment.critique}`
    );
  }
  if (!assessment.meetsBar) {
    errors.push(`judge did not consider this bar-meeting: ${assessment.critique}`);
  }

  return {
    id: scenario.id,
    description: scenario.description,
    passed: errors.length === 0,
    errors,
    speak: turnResult.speak,
    assessment,
  };
}

/** Blind-spot eval #3 — voice-turn reply PHRASING quality for a hands-busy kitchen/bar context. */
export async function runVoiceTurnQualityEval(): Promise<VoiceTurnQualityReport> {
  const results: VoiceTurnQualityResult[] = [];
  for (const scenario of VOICE_TURN_QUALITY_SCENARIOS) {
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
