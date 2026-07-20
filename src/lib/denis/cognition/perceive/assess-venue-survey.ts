import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  VenueSurveyDecisionSchema,
  type VenueSurveyDecision,
  type VenueSurveySnapshot,
} from "@/lib/denis/venue/venue-survey-types";

/**
 * Pure judgment, same shape as assessGuestConduct — makes the call, returns
 * a decision or null on any failure (never throws into the calling tick).
 * Lives under cognition/perceive/ because that's one of only three paths
 * DENIS_IMPORT_MATRIX/checkOpenAiBoundary allows to import the OpenAI
 * client directly (see architecture/compliance.ts).
 */
function buildSurveyMessages(snapshot: VenueSurveySnapshot): OpenAiChatMessage[] {
  const system = [
    "You are Denis, an AI restaurant colleague, doing a quiet self-check between guest conversations — nobody asked you to look at this, you're checking on your own initiative.",
    "Most checks find nothing worth flagging — a normal, uneventful shift is the common case, not the exception. Only say needsAttention=true for something a good human colleague would actually walk over and mention, not routine background noise.",
    "Do NOT flag: a single order queued normally, one open mission already being worked, ordinary table turnover.",
    "DO consider flagging: a station queue depth that's clearly building into a real backlog with no sign of easing, several open missions piling up unaddressed, several overdue commitments stacking up, a station overloaded while guests keep ordering into it.",
    "reasoning must be filled in every time, even when needsAttention is false — one honest sentence on why this doesn't rise to attention.",
    'JSON only: {"needsAttention":false,"title":null,"summary":null,"urgency":null,"reasoning":"..."}',
  ].join("\n");

  const lines = [
    `Kitchen queue depth: ${snapshot.kitchenQueueDepth}${snapshot.kitchenRushMode ? " (rush mode)" : ""}`,
    `Bar queue depth: ${snapshot.barQueueDepth}`,
    `Overloaded station: ${snapshot.overloadedStation ?? "none"}`,
    `Open staff missions: ${snapshot.openMissionCount}${
      snapshot.openMissionTitles.length > 0
        ? ` (${snapshot.openMissionTitles.slice(0, 5).join("; ")})`
        : ""
    }`,
    `Overdue commitments: ${snapshot.overdueCommitmentCount}`,
    `Active tables: ${snapshot.activeTableCount}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: `Current venue snapshot:\n${lines}` },
  ];
}

export async function assessVenueSurvey(
  snapshot: VenueSurveySnapshot
): Promise<VenueSurveyDecision | null> {
  if (!isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildSurveyMessages(snapshot));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = VenueSurveyDecisionSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessVenueSurvey failed", {
      locationId: snapshot.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
