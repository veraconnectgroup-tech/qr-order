import { ANTICIPATION_SCENARIOS } from "@/lib/denis/eval/fixtures/anticipation/scenarios";
import { WAITER_PARITY_SCENARIOS } from "@/lib/denis/eval/fixtures/waiter-parity/scenarios";
import type { AnticipationScenario } from "@/lib/denis/eval/anticipation-types";
import type { WaiterParityScenario } from "@/lib/denis/eval/waiter-parity-types";

export const VENUE_SIM_SESSION_TARGET = 100;
export const VENUE_SIM_ORDERING_SESSIONS = 70;
export const VENUE_SIM_PROACTIVE_SESSIONS = 30;

export const VENUE_SIM_PERSONAS = [
  "first_timer",
  "regular",
  "tourist",
  "business_lunch",
  "family",
  "solo_diner",
] as const;

export type VenueSimPersona = (typeof VENUE_SIM_PERSONAS)[number];

export type VenueSimDeploySession = {
  id: string;
  persona: VenueSimPersona;
  language: "sr" | "de" | "en";
  kind: "ordering" | "proactive";
  ordering?: WaiterParityScenario;
  proactive?: AnticipationScenario;
};

const LANGUAGES = ["sr", "de", "en"] as const;

/** 100 synthetic sessions: guest persona + ordering journey + proactive triggers. */
export function buildVenueSimDeploySessions(): VenueSimDeploySession[] {
  const sessions: VenueSimDeploySession[] = [];

  for (let i = 0; i < VENUE_SIM_ORDERING_SESSIONS; i += 1) {
    const ordering = WAITER_PARITY_SCENARIOS[i % WAITER_PARITY_SCENARIOS.length];
    sessions.push({
      id: `vs-order-${String(i + 1).padStart(3, "0")}`,
      persona: VENUE_SIM_PERSONAS[i % VENUE_SIM_PERSONAS.length],
      language: (ordering.sessionLanguage ??
        LANGUAGES[i % LANGUAGES.length]) as VenueSimDeploySession["language"],
      kind: "ordering",
      ordering,
    });
  }

  for (let i = 0; i < VENUE_SIM_PROACTIVE_SESSIONS; i += 1) {
    const proactive = ANTICIPATION_SCENARIOS[i % ANTICIPATION_SCENARIOS.length];
    sessions.push({
      id: `vs-proactive-${String(i + 1).padStart(3, "0")}`,
      persona: VENUE_SIM_PERSONAS[i % VENUE_SIM_PERSONAS.length],
      language: LANGUAGES[i % LANGUAGES.length],
      kind: "proactive",
      proactive,
    });
  }

  return sessions;
}
