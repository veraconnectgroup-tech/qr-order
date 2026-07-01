import type { ConciergeIntelligence } from "@/lib/denis/config/concierge-config.schema";
import {
  buildContextAwarenessSituationBlock,
  buildContextAwarenessSnapshot,
  type ContextAwarenessSnapshot,
} from "@/lib/denis/intelligence/event-context";
import {
  buildWeatherSituationBlock,
  loadCachedWeatherContext,
} from "@/lib/denis/intelligence/weather-context";

export type { ContextAwarenessSnapshot } from "@/lib/denis/intelligence/event-context";

export function buildExternalContextSituationBlock(
  snapshot: ContextAwarenessSnapshot | null | undefined
): string {
  if (!snapshot) return "";

  const blocks = [
    buildWeatherSituationBlock(snapshot.weather),
    buildContextAwarenessSituationBlock(snapshot),
  ].filter(Boolean);

  return blocks.join("\n\n");
}

export async function resolveContextAwareness(input: {
  locationId: string;
  intelligence: ConciergeIntelligence;
  language: string;
  venueEventConfig?: unknown;
  sportsMatchTonight?: boolean;
  nowMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ContextAwarenessSnapshot | null> {
  if (!input.intelligence.contextAwareness) return null;

  const weather = await loadCachedWeatherContext({
    locationId: input.locationId,
    intelligence: input.intelligence,
    language: input.language,
    fetchImpl: input.fetchImpl,
  });

  return buildContextAwarenessSnapshot({
    intelligence: input.intelligence,
    language: input.language,
    nowMs: input.nowMs,
    weather,
    venueEventConfig: input.venueEventConfig,
    sportsMatchTonight: input.sportsMatchTonight,
  });
}
