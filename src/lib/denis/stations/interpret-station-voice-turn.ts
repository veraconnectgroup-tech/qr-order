import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { perceiveStationVoiceTurnFromLlm } from "@/lib/denis/runtime/perceive/station-voice-turn-llm";
import {
  classifyStationVoiceReply,
  stationVoiceConfirmationLine,
} from "@/lib/denis/stations/classify-station-voice-reply";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import type { StationQuestionStation } from "@/lib/denis/stations/question-triggers";
import {
  buildStationVoiceClarifyLine,
  resolveStationVoiceConversationTurn,
} from "@/lib/denis/stations/station-voice-conversation";
import {
  parseStationQuestionContext,
  type StationVoiceQuestionContext,
  type StationVoiceTurn,
  type StationVoiceTurnResult,
} from "@/lib/denis/stations/station-voice-context";

export type {
  StationVoiceQuestionContext,
  StationVoiceTurn,
  StationVoiceTurnResult,
} from "@/lib/denis/stations/station-voice-context";

function buildContext(input: {
  questionMessage: string;
  questionType: StationQuestionRow["question_type"];
  station: StationQuestionStation;
  tableName?: string | null;
  orderNumber?: number | null;
  waitMinutes?: number | null;
}): StationVoiceQuestionContext {
  const parsed = parseStationQuestionContext(
    input.questionMessage,
    input.questionType,
    input.station
  );
  return {
    ...parsed,
    tableName: input.tableName ?? parsed.tableName,
    orderNumber: input.orderNumber ?? parsed.orderNumber,
    waitMinutes: input.waitMinutes ?? parsed.waitMinutes,
  };
}

/** LLM-backed staff voice turn — offline conversation + keyword classify first. */
export async function interpretStationVoiceTurn(
  input: {
    questionMessage: string;
    questionType: StationQuestionRow["question_type"];
    station: StationQuestionStation;
    staffTranscript: string;
    priorTurns: StationVoiceTurn[];
    tableName?: string | null;
    orderNumber?: number | null;
    waitMinutes?: number | null;
  },
  config: ConciergeConfig
): Promise<StationVoiceTurnResult> {
  const transcript = input.staffTranscript.trim();
  const context = buildContext(input);

  const keywordHit = classifyStationVoiceReply(transcript, input.questionType);
  if (keywordHit) {
    return {
      speak: stationVoiceConfirmationLine(keywordHit),
      resolved: keywordHit,
      continueListening: false,
    };
  }

  const conversational = resolveStationVoiceConversationTurn({
    context,
    staffTranscript: transcript,
    priorTurns: input.priorTurns,
  });
  if (conversational) return conversational;

  const llmTurn = await perceiveStationVoiceTurnFromLlm(
    { context, staffTranscript: transcript, priorTurns: input.priorTurns },
    config
  );
  if (llmTurn) return llmTurn;

  return {
    speak: buildStationVoiceClarifyLine(context),
    resolved: null,
    continueListening: true,
  };
}
