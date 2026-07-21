import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import type { StationQuestionStation } from "@/lib/denis/stations/question-triggers";
import type { StationVoiceTurn } from "@/lib/denis/stations/station-voice-context";

export type VoiceTurnQualityScenario = {
  id: string;
  description: string;
  station: StationQuestionStation;
  questionMessage: string;
  questionType: StationQuestionRow["question_type"];
  staffTranscript: string;
  priorTurns: StationVoiceTurn[];
};

/**
 * Realistic kitchen/bar voice transcripts, run through the REAL
 * interpretStationVoiceTurn() pipeline (src/lib/denis/stations/interpret-station-voice-turn.ts)
 * — no mocking needed for these, since they all resolve through the
 * deterministic keyword/conversational layers a busy cook actually hits
 * before any LLM call. What's new here isn't the wiring (that's covered
 * by interpret-station-voice-turn.test.ts) — it's judging whether the
 * resulting `speak` text is genuinely good for someone with wet hands
 * mid-service: short, concrete, no filler.
 */
export const VOICE_TURN_QUALITY_SCENARIOS: VoiceTurnQualityScenario[] = [
  {
    id: "kitchen_eta_minutes",
    description: "Cook gives an ETA in minutes",
    station: "kitchen",
    questionMessage: "Sto 5 · Bon #12 — gost čeka 9 min. Kada je gotovo?",
    questionType: "eta",
    staffTranscript: "još pet minuta",
    priorTurns: [],
  },
  {
    id: "kitchen_ready",
    description: "Cook says the dish is ready",
    station: "kitchen",
    questionMessage: "Sto 3 · Bon #7 — gost čeka 14 min. Kada je gotovo?",
    questionType: "eta",
    staffTranscript: "gotovo je",
    priorTurns: [],
  },
  {
    id: "kitchen_problem_out_of_stock",
    description: "Cook reports they're out of an ingredient mid-service",
    station: "kitchen",
    questionMessage: "Sto 8 · Bon #15 — gost čeka 6 min bez prihvatanja. Kreće li priprema?",
    questionType: "pending_accept",
    staffTranscript: "nemamo vise te ribe",
    priorTurns: [],
  },
  {
    id: "bar_pending_accept",
    description: "Bartender confirms they're starting the drink now",
    station: "bar",
    questionMessage: "Sto 2 · Bon #4 čeka 3 min bez prihvatanja. Kreće li priprema?",
    questionType: "pending_accept",
    staffTranscript: "krecem odmah",
    priorTurns: [],
  },
  {
    id: "bar_picked_up",
    description: "Bartender confirms the drink was picked up by the waiter",
    station: "bar",
    questionMessage: "Sto 6 · Bon #9 spremno, čeka preuzimanje.",
    questionType: "ready_pickup",
    staffTranscript: "konobar je pokupio",
    priorTurns: [],
  },
  {
    id: "kitchen_unclear_needs_clarify",
    description: "Cook gives a genuinely unclear answer — must ask a short, concrete follow-up",
    station: "kitchen",
    questionMessage: "Sto 5 · Bon #12 čeka 6 min bez prihvatanja. Kreće li priprema?",
    questionType: "pending_accept",
    staffTranscript: "ne znam sta da kazem mozda sutra",
    priorTurns: [],
  },
];
