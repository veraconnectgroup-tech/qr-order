import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";

export type StationVoiceReply = {
  answer: NonNullable<StationQuestionRow["answer"]>;
  etaMinutes?: number;
};

const NUMBER_WORDS_SR: Record<string, number> = {
  jedan: 1,
  jednu: 1,
  jednog: 1,
  dva: 2,
  dve: 2,
  dvije: 2,
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
  jedanaest: 11,
  dvanaest: 12,
  petnaest: 15,
  dvadeset: 20,
  trideset: 30,
};

/** STT often drops diacritics — normalize before keyword checks. */
export function normalizeStationTranscript(transcript: string): string {
  return transcript
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function extractSpokenMinutes(text: string): number | null {
  const digitMatch = text.match(/\b(\d{1,3})\b/);
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
  /\b(problem|kasni\w*|kasnimo|ne mozemo|nemamo|nestalo|otkazi\w*|otkazujemo|necemo stici|ne stignemo)\b/i;
const READY_WORDS =
  /\b(gotovo|gotov|gotova|spremno|spreman|spremna|zavrseno|izaslo|izlazi|poslato)\b/i;
const STARTING_WORDS =
  /\b(krece|krecemo|pocinjem|pocinjemo|radimo|idem|idemo|odmah|sad|vec radim|prihvaceno|prihvatam|moze|moze moze|ajde|da da|da krece|u redu)\b/i;
const PICKED_UP_WORDS =
  /\b(preuzeto|pokupio|pokupili|nosim|nosimo|uzeto|odneseno|waiter|konobar)\b/i;
const STILL_WAITING_WORDS =
  /\b(jos ceka|jos nije|nije preuzeto|nije jos|ceka konobar|jo[sš]? ne)\b/i;
const AFFIRMATIVE = /^(da|ok|oke|moze|ajde|u redu|super|važi|vazi)$/i;

/**
 * Maps spoken Serbian (kitchen/bar STT) to the same answer actions as tap buttons.
 * Tolerant — staff rarely speaks in exact keyword form.
 */
export function classifyStationVoiceReply(
  transcript: string,
  questionType: StationQuestionRow["question_type"]
): StationVoiceReply | null {
  const text = normalizeStationTranscript(transcript);
  if (!text) return null;

  if (PROBLEM_WORDS.test(text)) return { answer: "problem" };

  if (questionType === "eta" || questionType === "mixed_conflict") {
    const minutes = extractSpokenMinutes(text);
    if (minutes != null) return { answer: "eta", etaMinutes: minutes };
    if (READY_WORDS.test(text)) return { answer: "ready" };
    if (/\b(usoro|uskoro|malopre|par minuta|jos malo)\b/i.test(text)) {
      return { answer: "eta", etaMinutes: 5 };
    }
    return null;
  }

  if (questionType === "pending_accept") {
    if (STARTING_WORDS.test(text) || AFFIRMATIVE.test(text)) {
      return { answer: "accepted" };
    }
    const minutes = extractSpokenMinutes(text);
    if (minutes != null) return { answer: "accepted" };
    return null;
  }

  if (PICKED_UP_WORDS.test(text)) return { answer: "picked_up" };
  if (STILL_WAITING_WORDS.test(text)) return { answer: "still_waiting" };
  if (AFFIRMATIVE.test(text)) return { answer: "picked_up" };

  return null;
}

/** Short confirmation Denis says before logging the answer. */
export function stationVoiceConfirmationLine(reply: StationVoiceReply): string {
  switch (reply.answer) {
    case "eta":
      return reply.etaMinutes
        ? `Važi, javljam gostu oko ${reply.etaMinutes} minuta.`
        : "Važi, javljam gostu.";
    case "ready":
      return "Super, javljam da je gotovo.";
    case "accepted":
      return "Odlično, javljam da krećete.";
    case "picked_up":
      return "Važi, beležim preuzeto.";
    case "still_waiting":
      return "Razumem, još čeka.";
    case "problem":
      return "Važi, javljam menadžeru.";
  }
}

/** Mic sometimes picks up Denis's own TTS — ignore those transcripts. */
export function isLikelyDenisEchoTranscript(transcript: string): boolean {
  const text = normalizeStationTranscript(transcript);
  if (!text) return true;
  if (/\b(koji|koja|koj)\s*(sto|stol|bon)\b/.test(text)) return false;
  return (
    /\bnisam (razumeo|siguran|cuo)\b/.test(text) ||
    /\bjavljam (vam se|gostu)\b/.test(text) ||
    /\bdenis je spreman\b/.test(text) ||
    /\brecite (samo )?(broj )?minuta\b/.test(text) ||
    /\brecite koliko minuta\b/.test(text)
  );
}
