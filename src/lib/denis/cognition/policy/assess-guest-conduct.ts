import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  GuestConductAssessmentSchema,
  type GuestConductAssessment,
} from "@/lib/denis/cognition/policy/guest-conduct-assessment-types";

/**
 * No keyword/regex gate on purpose — the founder's explicit call: Denis is
 * a genuinely smart AI, tone assessment should come from real
 * understanding on every guest turn, not a raw keyword filter deciding
 * whether he's even allowed to think about it. abuse-protection.ts's
 * regex layer still exists, but only as an outage-only fallback in
 * run-guest-conduct-shadow-check.ts — never a co-equal detector, never a
 * gate in front of this function.
 */
function buildAssessmentMessages(
  guestMessage: string,
  recentTranscript: string[]
): OpenAiChatMessage[] {
  const system = [
    "You classify ONE guest chat message's tone toward Denis, a restaurant's AI assistant. You do not decide any consequence — only describe what you observe.",
    "toneTowardDenis: respectful (normal/neutral/friendly), curt (short/dismissive but not insulting), mild_insult (calling Denis stupid/useless/similar, without profanity), severe_insult (profanity, slurs, degrading language), threat (threatening Denis or implying harm).",
    "directedAt: denis (aimed at Denis specifically), service (frustration about food/wait/restaurant, not Denis personally), unclear (can't tell).",
    "confidence: your own calibration, 0 to 1 — be honest, don't inflate it.",
    "quotedSpan: the exact substring of the guest's message that drove your classification. If toneTowardDenis is respectful, quote whatever is most representative.",
    "Never invent tone that isn't in the text. Ordinary complaints about food, wait times, or the restaurant are 'service', not directed at Denis, even if blunt.",
    'JSON only: {"toneTowardDenis":"respectful","directedAt":"unclear","confidence":0.5,"quotedSpan":"..."}',
  ].join("\n");

  const history =
    recentTranscript.length > 0
      ? recentTranscript.slice(-6).join("\n")
      : "(no prior turns)";

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        `Recent conversation:\n${history}`,
        `Guest's latest message: ${guestMessage}`,
      ].join("\n\n"),
    },
  ];
}

/**
 * Pure perception — makes the LLM call, returns a structured assessment or
 * null on any failure (OpenAI unavailable, call error, malformed output).
 * Never throws into the calling turn; the deterministic policy engine
 * falls back to the regex-only signal when this returns null (see
 * run-guest-conduct-shadow-check.ts).
 */
export async function assessGuestConduct(input: {
  message: string;
  recentTranscript?: string[];
}): Promise<GuestConductAssessment | null> {
  if (!isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(
      buildAssessmentMessages(input.message, input.recentTranscript ?? [])
    );
    const raw = JSON.parse(result.content) as unknown;
    const parsed = GuestConductAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessGuestConduct failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
