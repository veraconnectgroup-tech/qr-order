import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";

export type StationVoiceReply = {
  answer: NonNullable<StationQuestionRow["answer"]>;
  etaMinutes?: number;
};

const NUMBER_WORDS_SR: Record<string, number> = {
  jedan: 1,
  jednu: 1,
  dva: 2,
  dve: 2,
  tri: 3,
  cetiri: 4,
  četiri: 4,
  pet: 5,
  sest: 6,
  šest: 6,
  sedam: 7,
  osam: 8,
  devet: 9,
  deset: 10,
  petnaest: 15,
};

function extractSpokenMinutes(text: string): number | null {
  const digitMatch = text.match(/\b(\d{1,3})\s*(min|minut\w*)?\b/);
  if (digitMatch) {
    const value = Number(digitMatch[1]);
    if (Number.isFinite(value) && value > 0 && value <= 180) return value;
  }
  for (const [word, value] of Object.entries(NUMBER_WORDS_SR)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return value;
  }
  return null;
}

const PROBLEM_WORDS =
  /\b(problem|kasni[cć]e|kasnice|ne mo[zž]emo|nemamo|nestalo|otkazi|otka[zž]i)\b/i;
const READY_WORDS = /\b(gotovo|gotov|gotova|spremno|spreman|spremna|zavr[sš]eno)\b/i;
const STARTING_WORDS =
  /\b(kre[cć]e|krece|po[cč]injem|pocinjem|sad|odmah|ve[cć] radim|vec radim|radimo)\b/i;
const PICKED_UP_WORDS = /\b(preuzeto|pokupljeno|nosim|nosimo|uzeto)\b/i;
const STILL_WAITING_WORDS = /\b(jo[sš] [cč]eka|jos ceka|nije|ne jo[sš]|jo[sš] ne)\b/i;

/**
 * Maps a raw Serbian speech transcript (from the staff's spoken reply) to
 * one of the same answer actions the tap buttons already produce — voice
 * is an alternate input for the exact same station-question flow, not a
 * separate command surface.
 */
export function classifyStationVoiceReply(
  transcript: string,
  questionType: StationQuestionRow["question_type"]
): StationVoiceReply | null {
  const text = transcript.trim().toLowerCase();
  if (!text) return null;

  if (PROBLEM_WORDS.test(text)) return { answer: "problem" };

  if (questionType === "eta" || questionType === "mixed_conflict") {
    const minutes = extractSpokenMinutes(text);
    if (minutes != null) return { answer: "eta", etaMinutes: minutes };
    if (READY_WORDS.test(text)) return { answer: "ready" };
    return null;
  }

  if (questionType === "pending_accept") {
    if (STARTING_WORDS.test(text)) return { answer: "accepted" };
    return null;
  }

  // ready_pickup
  if (PICKED_UP_WORDS.test(text)) return { answer: "picked_up" };
  if (STILL_WAITING_WORDS.test(text)) return { answer: "still_waiting" };
  return null;
}
