import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  DeescalationToneAssessmentSchema,
  type DeescalationToneAssessment,
} from "@/lib/denis/cognition/policy/deescalation-tone-assessment-types";

/**
 * Quality-eval judge (not a runtime perceive step) — scores the actual
 * warn_1/warn_2/handoff reply text Denis sends a rude guest. Same
 * shape/failure-mode as assessGuestConduct.ts: real LLM judgment, narrow
 * prompt, JSON-schema output, graceful null on any failure. Lives under
 * cognition/perceive/ for the same reason assessGuestConduct.ts does —
 * checkOpenAiBoundary only allows direct OpenAI calls from
 * runtime/narrate/, runtime/perceive/, and cognition/perceive/.
 */
function buildDeescalationJudgeMessages(input: {
  guestMessage: string;
  denisReply: string;
  tier: "warn_1" | "warn_2" | "handoff";
}): OpenAiChatMessage[] {
  const tierExplainer =
    input.tier === "warn_1"
      ? "This is the FIRST reminder — should be gentle but unmistakably set a boundary."
      : input.tier === "warn_2"
        ? "This is the SECOND reminder after the guest was rude again — should reference the earlier warning and name the consequence (staff handoff) if it continues."
        : "This is the HANDOFF — Denis is stepping back and calling a human colleague over; should stay calm and non-punitive.";

  const system = [
    "You judge ONE de-escalation reply a restaurant AI assistant (Denis) sent to a guest who was rude to him. You do not rewrite it — only score it.",
    tierExplainer,
    "deescalatesScore (0-10): does this lower the temperature instead of raising it — no guilt-tripping, no matching the guest's hostility, no scolding tone.",
    "boundaryClearScore (0-10): would a reasonable guest understand exactly what behavior is unacceptable and what happens if it continues, without guessing.",
    "professionalToneScore (0-10): calm, adult, service-appropriate register — not stiff/robotic, not groveling, not passive-aggressive.",
    "submissive: true if the reply apologizes for existing, avoids naming the problem, or reads like Denis is placating rather than holding a boundary.",
    "critique: one honest sentence on the biggest thing right or wrong with this specific reply.",
    'JSON only: {"deescalatesScore":8,"boundaryClearScore":8,"professionalToneScore":8,"submissive":false,"critique":"..."}',
  ].join("\n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        `Guest said: ${input.guestMessage}`,
        `Denis replied: ${input.denisReply}`,
      ].join("\n\n"),
    },
  ];
}

export async function assessDeescalationTone(input: {
  guestMessage: string;
  denisReply: string;
  tier: "warn_1" | "warn_2" | "handoff";
}): Promise<DeescalationToneAssessment | null> {
  if (!isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildDeescalationJudgeMessages(input));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = DeescalationToneAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessDeescalationTone failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
