import { z } from "zod";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  classifyStationVoiceReply,
  stationVoiceConfirmationLine,
  type StationVoiceReply,
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
import { logger } from "@/lib/logger";

export type {
  StationVoiceQuestionContext,
  StationVoiceTurn,
  StationVoiceTurnResult,
} from "@/lib/denis/stations/station-voice-context";

const StationVoiceLlmSchema = z.object({
  speak: z.string().trim().min(1).max(500),
  resolved: z.boolean(),
  answer: z
    .enum([
      "eta",
      "ready",
      "problem",
      "accepted",
      "picked_up",
      "still_waiting",
    ])
    .nullable()
    .optional(),
  etaMinutes: z.number().int().min(1).max(180).nullable().optional(),
  continueListening: z.boolean(),
});

function stationLabel(station: StationQuestionStation): string {
  return station === "kitchen" ? "kuhinji" : "baru";
}

function questionTypeHint(
  questionType: StationQuestionRow["question_type"]
): string {
  switch (questionType) {
    case "pending_accept":
      return "Treba da saznam da li kreće priprema (accepted) ili ima problem.";
    case "eta":
      return "Treba ETA u minutama (eta + etaMinutes), gotovo (ready), ili problem.";
    case "ready_pickup":
      return "Treba da saznam da li je porudžbina preuzeta (picked_up), još čeka (still_waiting), ili problem.";
    case "mixed_conflict":
      return "Treba ETA, ready, ili problem — piće vs hrana.";
  }
}

function formatContextForPrompt(context: StationVoiceQuestionContext): string {
  const parts = [
    context.tableName ? `Sto: ${context.tableName}` : null,
    context.orderNumber != null ? `Bon: #${context.orderNumber}` : null,
    context.waitMinutes != null ? `Gost čeka: ${context.waitMinutes} min` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : context.questionMessage;
}

function buildStaffVoiceMessages(input: {
  context: StationVoiceQuestionContext;
  staffTranscript: string;
  priorTurns: StationVoiceTurn[];
}): OpenAiChatMessage[] {
  const history =
    input.priorTurns.length > 0
      ? input.priorTurns
          .map((turn) =>
            turn.role === "denis"
              ? `Denis: ${turn.text}`
              : `Osoblje: ${turn.text}`
          )
          .join("\n")
      : "(još nema razgovora)";

  return [
    {
      role: "system",
      content: [
        `Ti si Denis, AI konobar koji zove ${stationLabel(input.context.station)} zbog gosta koji čeka.`,
        "Govoriš srpski, prirodno i ljubazno — kao kolega u smeni, ne robot sa menijem komandi.",
        "Vodiš kratak razgovor: ako te osoblje pita koji sto, bon ili šta tačno treba — odgovori konkretno iz konteksta, pa nastavi da pitaš za status.",
        "Nikad ne reci samo 'recite broj minuta' bez konteksta — uvek uključi sto/bon ako ih imaš.",
        questionTypeHint(input.context.questionType),
        "Kada imaš jasan status, resolved=true i postavi answer (+ etaMinutes ako je eta).",
        "Inače resolved=false, odgovori prirodnim govorom (speak) i continueListening=true.",
        "Max 2–3 kratke rečenice u speak.",
        'JSON only: {"speak":"...","resolved":false,"answer":null,"etaMinutes":null,"continueListening":true}',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Kontekst: ${formatContextForPrompt(input.context)}`,
        `Pitanje (kartica): ${input.context.questionMessage}`,
        `Istorija:\n${history}`,
        `Osoblje sada kaže: ${input.staffTranscript}`,
      ].join("\n\n"),
    },
  ];
}

function parseLlmTurn(
  content: string,
  questionType: StationQuestionRow["question_type"]
): StationVoiceTurnResult | null {
  try {
    const raw = JSON.parse(content) as unknown;
    const parsed = StationVoiceLlmSchema.safeParse(raw);
    if (!parsed.success) return null;

    const row = parsed.data;
    if (!row.resolved) {
      return {
        speak: row.speak,
        resolved: null,
        continueListening: row.continueListening,
      };
    }

    if (!row.answer) return null;
    if (row.answer === "eta" && (!row.etaMinutes || row.etaMinutes <= 0)) {
      return null;
    }

    const resolved: StationVoiceReply = {
      answer: row.answer,
      ...(row.answer === "eta" && row.etaMinutes
        ? { etaMinutes: row.etaMinutes }
        : {}),
    };

    return {
      speak: row.speak,
      resolved,
      continueListening: false,
    };
  } catch {
    return null;
  }
}

function buildContext(
  input: {
    questionMessage: string;
    questionType: StationQuestionRow["question_type"];
    station: StationQuestionStation;
    tableName?: string | null;
    orderNumber?: number | null;
    waitMinutes?: number | null;
  }
): StationVoiceQuestionContext {
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

  if (isOpenAiConfigured()) {
    const model =
      config.llm.model?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      undefined;

    try {
      const result = await callOpenAiChat(
        buildStaffVoiceMessages({ context, staffTranscript: transcript, priorTurns: input.priorTurns }),
        { model }
      );
      const parsed = parseLlmTurn(result.content, input.questionType);
      if (parsed) return parsed;
    } catch (error) {
      logger.warn("interpretStationVoiceTurn LLM failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    speak: buildStationVoiceClarifyLine(context),
    resolved: null,
    continueListening: true,
  };
}
