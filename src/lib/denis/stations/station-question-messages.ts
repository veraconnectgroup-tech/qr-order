import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import type { StationQuestionStation } from "@/lib/denis/stations/question-triggers";

export type StationQuestionAnswerValue =
  | "eta"
  | "ready"
  | "problem"
  | "accepted"
  | "picked_up"
  | "still_waiting";

export type FreshStationAnswer = {
  station: StationQuestionStation;
  answer: StationQuestionAnswerValue;
  etaMinutes: number | null;
  answeredAt: string;
  ageMinutes: number;
};

/** Guest copy for a fresh station answer (localized). */
export function stationAnswerGuestMessage(input: {
  station: StationQuestionStation;
  answer: StationQuestionAnswerValue;
  etaMinutes: number | null;
  language: string;
}): string | null {
  if (input.answer === "eta" && input.etaMinutes) {
    return tForAiGuestLanguage(
      input.station === "kitchen"
        ? "ai.station.etaAnswer.kitchen"
        : "ai.station.etaAnswer.bar",
      input.language,
      { minutes: input.etaMinutes }
    );
  }
  if (input.answer === "ready") {
    return tForAiGuestLanguage(
      input.station === "kitchen"
        ? "ai.station.readyAnswer.kitchen"
        : "ai.station.readyAnswer.bar",
      input.language
    );
  }
  if (input.answer === "problem") {
    return tForAiGuestLanguage("ai.station.problem", input.language);
  }
  return null;
}

/** Guest copy when Denis reuses a cached answer instead of re-asking. */
export function cachedStationAnswerGuestMessage(input: {
  fresh: FreshStationAnswer;
  language: string;
}): string | null {
  if (input.fresh.answer === "eta" && input.fresh.etaMinutes) {
    const remaining = Math.max(
      1,
      input.fresh.etaMinutes - input.fresh.ageMinutes
    );
    return tForAiGuestLanguage(
      input.fresh.station === "kitchen"
        ? "ai.station.etaAnswerAgo.kitchen"
        : "ai.station.etaAnswerAgo.bar",
      input.language,
      { ago: Math.max(1, input.fresh.ageMinutes), minutes: remaining }
    );
  }
  return stationAnswerGuestMessage({
    station: input.fresh.station,
    answer: input.fresh.answer,
    etaMinutes: input.fresh.etaMinutes,
    language: input.language,
  });
}

/** Guest copy right after Denis sends the question to the station. */
export function stationCheckingGuestMessage(input: {
  station: StationQuestionStation;
  language: string;
}): string {
  return tForAiGuestLanguage(
    input.station === "kitchen"
      ? "ai.station.checking.kitchen"
      : "ai.station.checking.bar",
    input.language
  );
}
