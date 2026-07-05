import { normalizeStationTranscript } from "@/lib/denis/stations/classify-station-voice-reply";
import {
  formatStationVoiceBonLabel,
  formatStationVoiceTableLabel,
  formatStationVoiceWaitPhrase,
  type StationVoiceQuestionContext,
  type StationVoiceTurn,
  type StationVoiceTurnResult,
} from "@/lib/denis/stations/station-voice-context";

const TABLE_QUESTION =
  /\b(koji|koja|koje|koj|kakav|kakvo|kakve)\s*(sto|stol|stola|stolu|stolovi)\b|\b(za\s*)?(koji|koj)\s*st(o|ol)\b|\bstol\s*(broj|naziv)\b|\bwhich\s+table\b/i;
const ORDER_QUESTION =
  /\b(koji|koja|koje|koj|kakav|kakvo)\s*(bon|order|porudzbin|porudzbu)\b|\bbroj\s*(bona|porudzbine)\b|\bwhich\s+order\b/i;
const REPEAT_QUESTION =
  /\b(ponovi|ponov(i|o)|ponovo|sta\s+(si|ste)\s+(rek|pit|traz)|nisi\s+cuo|jos\s+jednom|repeat)\b/i;
const WHAT_DO_YOU_NEED =
  /\b(sta\s+(treba|hoces|trazis|pitas|zelis)|kakav\s+status|sta\s+je\s+pitanje|sta\s+mi\s+trazis|about\s+what)\b/i;
const GREETING =
  /^(zdravo|cao|ca|hej|hello|hi|ej|alo|dobar\s+dan)\b/i;

function stationLabel(station: StationVoiceQuestionContext["station"]): string {
  return station === "kitchen" ? "kuhinji" : "baru";
}

function openingNeedLine(context: StationVoiceQuestionContext): string {
  const table = formatStationVoiceTableLabel(context);
  const bon = formatStationVoiceBonLabel(context);
  const wait = formatStationVoiceWaitPhrase(context);

  switch (context.questionType) {
    case "pending_accept":
      return `${table}, ${bon} — porudžbina još nije prihvaćena.${wait} Treba mi da znam da li krećete sa pripremom.`;
    case "ready_pickup":
      return `${table}, ${bon} — jelo ili piće je spremno.${wait} Treba mi da znam da li je konobar već preuzeo.`;
    case "mixed_conflict":
      return `${table} — gost čeka piće dok se hrana sprema.${wait} Treba mi status pića: izašlo li ili koliko još?`;
    case "eta":
    default:
      return `${table}, ${bon}.${wait} Treba mi procena — koliko minuta do gotovog, ili je već spremno?`;
  }
}

function answerTableQuestion(context: StationVoiceQuestionContext): string {
  const table = formatStationVoiceTableLabel(context);
  const bon = formatStationVoiceBonLabel(context);
  const wait = formatStationVoiceWaitPhrase(context);
  return `Pitam za ${table}, ${bon}.${wait}`;
}

function answerOrderQuestion(context: StationVoiceQuestionContext): string {
  const table = formatStationVoiceTableLabel(context);
  const bon = formatStationVoiceBonLabel(context);
  return context.orderNumber != null
    ? `${bon.charAt(0).toUpperCase()}${bon.slice(1)}, ${table.toLowerCase()}.`
    : `${table}, konkretan broj bona nisam imao u kartici — pogledajte porudžbinu na ekranu.`;
}

function answerRepeatQuestion(context: StationVoiceQuestionContext): string {
  return openingNeedLine(context);
}

function answerWhatYouNeed(context: StationVoiceQuestionContext): string {
  const target = stationLabel(context.station);
  return `Zovem ${target} zbog gosta. ${openingNeedLine(context)}`;
}

function answerGreeting(context: StationVoiceQuestionContext): string {
  return `Zdravo. ${openingNeedLine(context)}`;
}

/** Natural staff↔Denis replies without LLM — answers clarifying questions from card context. */
export function resolveStationVoiceConversationTurn(input: {
  context: StationVoiceQuestionContext;
  staffTranscript: string;
  priorTurns: StationVoiceTurn[];
}): StationVoiceTurnResult | null {
  const text = normalizeStationTranscript(input.staffTranscript);
  if (!text || text.length < 2) return null;

  if (TABLE_QUESTION.test(text)) {
    return {
      speak: `${answerTableQuestion(input.context)} Recite mi status kad budete spremni.`,
      resolved: null,
      continueListening: true,
    };
  }

  if (ORDER_QUESTION.test(text)) {
    return {
      speak: `${answerOrderQuestion(input.context)} Recite mi status kad budete spremni.`,
      resolved: null,
      continueListening: true,
    };
  }

  if (REPEAT_QUESTION.test(text)) {
    return {
      speak: answerRepeatQuestion(input.context),
      resolved: null,
      continueListening: true,
    };
  }

  if (WHAT_DO_YOU_NEED.test(text)) {
    return {
      speak: answerWhatYouNeed(input.context),
      resolved: null,
      continueListening: true,
    };
  }

  if (GREETING.test(text)) {
    return {
      speak: answerGreeting(input.context),
      resolved: null,
      continueListening: true,
    };
  }

  return null;
}

/** Contextual follow-up when speech is unclear — not a rigid keyword menu. */
export function buildStationVoiceClarifyLine(
  context: StationVoiceQuestionContext
): string {
  return openingNeedLine(context);
}
