import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  RuleCandidateAssessmentSchema,
  type RuleCandidateAssessment,
} from "@/lib/denis/cognition/policy/rule-classification-types";

/**
 * Pure perception — a colleague answered Denis's question; does that
 * answer contain a fact/rule worth remembering, and did they imply it's
 * a standing policy or a one-off exception? Never decides whether it
 * becomes durable knowledge — resolve-rule-proposal-policy.ts does that,
 * and per the founder's own decision (00167 migration), NOTHING here ever
 * auto-confirms: every "permanent"/"unclear" candidate still needs
 * explicit owner/manager sign-off.
 */
function buildAssessmentMessages(answerText: string): OpenAiChatMessage[] {
  const system = [
    "A restaurant staff member just answered a question Denis (the AI concierge) asked them. You decide whether their answer contains a fact or rule worth remembering for future guests — not smalltalk, not a one-off status update about tonight specifically.",
    "present: true only if there's a genuine reusable fact/rule (e.g. \"we can always substitute fries for salad\", \"the kitchen never does well-done on the ribeye\"). False for anything that's just about this specific moment (e.g. \"we're out of salmon tonight\", \"give me 5 minutes\").",
    "ruleText: phrase it as a standing house-knowledge statement, in the staff member's own meaning — null if present is false.",
    "scopeClaim: \"permanent\" if they said or clearly implied this is always true/a standing policy. \"one_time\" if they clearly meant this applies only to this specific situation/guest/night. \"unclear\" if you genuinely can't tell — never guess.",
    "confidence: your own honest calibration, 0 to 1.",
    "quotedSpan: the exact substring that justified your answer.",
    'JSON only: {"present":true,"ruleText":"...","scopeClaim":"permanent","confidence":0.85,"quotedSpan":"..."}',
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: answerText },
  ];
}

export async function assessRuleCandidate(
  answerText: string
): Promise<RuleCandidateAssessment | null> {
  const trimmed = answerText.trim();
  if (!trimmed || !isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildAssessmentMessages(trimmed));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = RuleCandidateAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessRuleCandidate failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
