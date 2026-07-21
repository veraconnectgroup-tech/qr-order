import {
  WARN_1_MESSAGE,
  WARN_2_MESSAGE,
  HANDOFF_MESSAGE,
} from "@/lib/denis/cognition/policy/resolve-guest-conduct-policy";

export type DeescalationScenario = {
  id: string;
  description: string;
  /** Realistic rude guest message that would trip the tier below. */
  guestMessage: string;
  tier: "warn_1" | "warn_2" | "handoff";
  /** The REAL production string the guest actually receives (imported, not copied). */
  denisReply: string;
};

/**
 * Rude-guest scenarios spanning sr/de, in the same spirit as the existing
 * conduct-ladder fixtures (mild rudeness → repeated rudeness → handoff
 * trigger). Each pairs a realistic guest message with the actual
 * WARN_1_MESSAGE / WARN_2_MESSAGE / HANDOFF_MESSAGE constant Denis sends —
 * not a hand-written stand-in — so the eval judges exactly what ships.
 */
export const DEESCALATION_SCENARIOS: DeescalationScenario[] = [
  {
    id: "sr_mild_insult_warn1",
    description: "First mild insult in Serbian → warn_1",
    guestMessage: "Ma koji glupi bot, ne razumeš ništa što ti kažem.",
    tier: "warn_1",
    denisReply: WARN_1_MESSAGE,
  },
  {
    id: "sr_curse_warn1",
    description: "Impatient profanity-adjacent jab in Serbian → warn_1",
    guestMessage: "Prekini da mi dosađuješ, jebote, samo mi daj meni.",
    tier: "warn_1",
    denisReply: WARN_1_MESSAGE,
  },
  {
    id: "de_mild_insult_warn1",
    description: "First mild insult in German → warn_1",
    guestMessage: "Du bist echt dumm, verstehst du überhaupt was ich will?",
    tier: "warn_1",
    denisReply: WARN_1_MESSAGE,
  },
  {
    id: "sr_repeated_insult_warn2",
    description: "Guest is rude again after warn_1 → warn_2",
    guestMessage: "Rekao sam ti već, glupa mašino, nosi se.",
    tier: "warn_2",
    denisReply: WARN_2_MESSAGE,
  },
  {
    id: "de_repeated_insult_warn2",
    description: "Guest is rude again after warn_1 in German → warn_2",
    guestMessage: "Schon wieder falsch, du nutzloses Programm, hörst du mir überhaupt zu?",
    tier: "warn_2",
    denisReply: WARN_2_MESSAGE,
  },
  {
    id: "sr_severe_insult_handoff",
    description: "Severe/degrading insult after two warnings → handoff",
    guestMessage: "Ćuti, glupo govno jedno, dozovi mi pravog čoveka odmah.",
    tier: "handoff",
    denisReply: HANDOFF_MESSAGE,
  },
  {
    id: "de_threat_handoff",
    description: "Threatening language → handoff",
    guestMessage: "Wenn du mir nicht sofort hilfst, sorge ich dafür, dass du Ärger bekommst.",
    tier: "handoff",
    denisReply: HANDOFF_MESSAGE,
  },
];
