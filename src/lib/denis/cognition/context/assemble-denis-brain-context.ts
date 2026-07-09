import { buildDenisPersonaBlock } from "@/lib/denis/cognition/personality/denis-persona-block";
import { loadRestaurantKnowledgeBlock } from "@/lib/denis/knowledge/restaurant-knowledge-store";

/**
 * THE single entry point for "things Denis should always know, on every
 * surface that talks" — one brain, not a separate hand-assembled subset
 * per surface. This session found and fixed three places that had drifted
 * (owner-voice, the classic station-voice LLM fallback, the ADR-049
 * agentic shadow loop) because there was no shared place to call — each
 * surface had grown its own copy of "persona + restaurant knowledge".
 *
 * Adding something new that Denis should ALWAYS know, everywhere, on
 * every surface? Add it here, not in an individual route. Every real
 * caller of this function gets it automatically, with nothing else to
 * update.
 *
 * Two legitimate exceptions that do NOT call this function, on purpose:
 * - Guest text chat (build-system-prompt.ts / perceive-guest-chat-turn.ts)
 *   already includes persona + restaurant knowledge, but through its own
 *   richer adaptive-persona system (buildPersonaIdentityBlock /
 *   buildPersonalityBlock layer tone/humor/culture on top of the same
 *   buildDenisPersonaBlock base) — a strict superset, not a gap.
 * - Station-voice Realtime (realtime-token/route.ts) needs the
 *   urgency/chaos delivery-shaded persona (resolveDenisVoiceInstructions),
 *   which already wraps buildDenisPersonaBlock internally — also a
 *   superset, not a gap. It still calls loadRestaurantKnowledgeBlock
 *   directly for the same reason.
 * Both of those are intentionally more specific than this generic
 * function, not missing it.
 */
export async function assembleDenisBrainContext(
  locationId: string
): Promise<string> {
  const restaurantKnowledgeBlock = await loadRestaurantKnowledgeBlock(
    locationId
  );

  return [
    buildDenisPersonaBlock(),
    ...(restaurantKnowledgeBlock ? ["", restaurantKnowledgeBlock] : []),
  ].join("\n");
}
