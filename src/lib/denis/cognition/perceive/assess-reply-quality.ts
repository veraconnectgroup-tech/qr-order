import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  ReplyQualityAssessmentSchema,
  type ReplyQualityAssessment,
} from "@/lib/denis/cognition/policy/reply-quality-assessment-types";

/**
 * Generic quality-eval judge (not a runtime perceive step) — scores one
 * Denis reply against a caller-supplied rubric. Same shape/failure-mode as
 * assessGuestConduct.ts / assessVenueSurvey.ts: real LLM judgment, narrow
 * prompt, JSON-schema output, graceful null on any failure. Deliberately
 * generic (rubric + contextNote passed in) so it backs two different
 * blind-spot evals — multilingual phrasing quality and voice-turn
 * kitchen/bar phrasing quality — without duplicating this boilerplate.
 */
function buildReplyQualityJudgeMessages(input: {
  contextNote: string;
  rubric: string[];
  guestOrStaffMessage: string;
  denisReply: string;
}): OpenAiChatMessage[] {
  const system = [
    "You judge ONE reply from Denis, a restaurant AI assistant/colleague. You do not rewrite it — only score it.",
    input.contextNote,
    "Score 0-10 for how well the reply meets ALL of the following, weighted equally:",
    ...input.rubric.map((line, i) => `${i + 1}. ${line}`),
    "meetsBar: true only if the reply has no real problem a native speaker / busy cook would notice — reserve for genuinely good replies.",
    "issues: short list of concrete problems (empty array if none) — e.g. \"unnatural word order\", \"too long for hands-busy context\", \"wrong register\".",
    "critique: one honest sentence on the biggest thing right or wrong with this specific reply.",
    'JSON only: {"score":8,"meetsBar":true,"issues":[],"critique":"..."}',
  ].join("\n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        `Guest/staff said: ${input.guestOrStaffMessage}`,
        `Denis replied: ${input.denisReply}`,
      ].join("\n\n"),
    },
  ];
}

export async function assessReplyQuality(input: {
  contextNote: string;
  rubric: string[];
  guestOrStaffMessage: string;
  denisReply: string;
}): Promise<ReplyQualityAssessment | null> {
  if (!isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildReplyQualityJudgeMessages(input));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = ReplyQualityAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessReplyQuality failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
