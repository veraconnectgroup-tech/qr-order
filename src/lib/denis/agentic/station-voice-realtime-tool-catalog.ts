import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import {
  answerStationQuestion,
  type StationQuestionAnswerValue,
} from "@/lib/denis/stations/station-questions";

/**
 * Realtime tool catalog for the station-voice conversation (kitchen/bar
 * staff talking to Denis) — Phase 2.3 of the ADR-051-adjacent Realtime
 * migration plan. One tool: resolving the open station_questions row this
 * conversation is about. Reuses answerStationQuestion (the exact same
 * write path the classic keyword/LLM flow already uses) — the Realtime
 * loop is a new caller, not a new way to mutate station_questions.
 */

export type StationVoiceToolName = "resolve_station_question";

const RESOLVE_ANSWER_VALUES: readonly StationQuestionAnswerValue[] = [
  "eta",
  "ready",
  "problem",
  "accepted",
  "picked_up",
  "still_waiting",
];

export const resolveStationQuestionTool: OpenAiToolDefinition = {
  name: "resolve_station_question",
  description:
    "Call this once you have a clear status for this station question from what the staff member said. Never call it on a vague or unclear reply — ask a brief clarifying question instead.",
  parameters: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        enum: RESOLVE_ANSWER_VALUES,
        description:
          "eta = gave a time estimate, ready = order is ready, problem = something is wrong, accepted = acknowledged/working on it, picked_up = order was picked up, still_waiting = no new info yet.",
      },
      etaMinutes: {
        type: "integer",
        minimum: 1,
        maximum: 180,
        description: "Only when answer is 'eta' — minutes until ready.",
      },
    },
    required: ["answer"],
  },
};

export function listStationVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return [resolveStationQuestionTool];
}

export function isStationVoiceToolName(
  name: string
): name is StationVoiceToolName {
  return name === "resolve_station_question";
}

export async function executeStationVoiceTool(
  admin: SupabaseClient,
  input: {
    questionId: string;
    staffId: string;
    args: { answer?: unknown; etaMinutes?: unknown };
  }
): Promise<unknown> {
  const answer = input.args.answer;
  if (
    typeof answer !== "string" ||
    !RESOLVE_ANSWER_VALUES.includes(answer as StationQuestionAnswerValue)
  ) {
    return { ok: false, error: "invalid_answer" };
  }

  const etaMinutes =
    typeof input.args.etaMinutes === "number" ? input.args.etaMinutes : null;

  const result = await answerStationQuestion(admin, {
    questionId: input.questionId,
    answer: answer as StationQuestionAnswerValue,
    etaMinutes,
    staffId: input.staffId,
  });

  return result;
}
