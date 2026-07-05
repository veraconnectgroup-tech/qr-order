import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import type { StationQuestionStation } from "@/lib/denis/stations/question-triggers";

export type StationVoiceTurn = {
  role: "denis" | "staff";
  text: string;
};

export type StationVoiceReplyResolved = {
  answer: NonNullable<StationQuestionRow["answer"]>;
  etaMinutes?: number;
};

export type StationVoiceTurnResult = {
  speak: string;
  resolved: StationVoiceReplyResolved | null;
  continueListening: boolean;
};

export type StationVoiceQuestionContext = {
  questionMessage: string;
  questionType: StationQuestionRow["question_type"];
  station: StationQuestionStation;
  tableName: string | null;
  orderNumber: number | null;
  waitMinutes: number | null;
};

/** Pull table / bon / wait from staff-facing question card copy. */
export function parseStationQuestionContext(
  message: string,
  questionType: StationQuestionRow["question_type"],
  station: StationQuestionStation
): StationVoiceQuestionContext {
  const tableMatch = message.match(/Sto\s+([^·\n—]+?)(?:\s*·|\s*—|\s+čeka|\s*$)/i);
  const bonMatch = message.match(/Bon\s*#?\s*(\d+)/i);
  const waitMatch = message.match(/(\d+)\s*min/i);

  return {
    questionMessage: message,
    questionType,
    station,
    tableName: tableMatch?.[1]?.trim() ?? null,
    orderNumber: bonMatch ? Number(bonMatch[1]) : null,
    waitMinutes: waitMatch ? Number(waitMatch[1]) : null,
  };
}

export function formatStationVoiceTableLabel(
  context: Pick<StationVoiceQuestionContext, "tableName">
): string {
  return context.tableName ? `Sto ${context.tableName}` : "Ovaj sto";
}

export function formatStationVoiceBonLabel(
  context: Pick<StationVoiceQuestionContext, "orderNumber">
): string {
  return context.orderNumber != null
    ? `bon broj ${context.orderNumber}`
    : "porudžbina";
}

export function formatStationVoiceWaitPhrase(
  context: Pick<StationVoiceQuestionContext, "waitMinutes">
): string {
  if (context.waitMinutes == null || !Number.isFinite(context.waitMinutes)) {
    return "";
  }
  return ` Gost čeka već ${context.waitMinutes} minuta.`;
}
