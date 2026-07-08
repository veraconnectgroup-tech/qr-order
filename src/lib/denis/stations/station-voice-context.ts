import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import type { StationQuestionStation } from "@/lib/denis/stations/question-triggers";
import {
  resolveVoiceAudioProfile,
  type VoiceAudioEnvironment,
} from "@/lib/denis/surfaces/voice/voice-audio-config";

/** How staff/guest arms mic capture — wired per station in ADR-051 B1. */
export type VoiceInputMode = "wake-word" | "push-to-talk";

export const VOICE_INPUT_MODES = ["wake-word", "push-to-talk"] as const satisfies readonly VoiceInputMode[];

export function isPushToTalkMode(mode: VoiceInputMode): boolean {
  return mode === "push-to-talk";
}

export function isWakeWordMode(mode: VoiceInputMode): boolean {
  return mode === "wake-word";
}

/** Kitchen = wake + aggressive profile; bar/grill = push-to-talk + industrial. */
export function resolveStationVoiceAudioEnvironment(
  station: StationQuestionStation
): VoiceAudioEnvironment {
  return station === "kitchen" ? "kitchen" : "industrial";
}

export function resolveStationVoiceInputMode(
  station: StationQuestionStation
): VoiceInputMode {
  return resolveVoiceAudioProfile(
    resolveStationVoiceAudioEnvironment(station)
  ).inputMode;
}

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
