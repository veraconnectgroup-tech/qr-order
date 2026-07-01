import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveTableSessionActorEnabled } from "@/lib/denis/config/rollout";
import { isInterventionJournalActive } from "@/lib/denis/config/resolve-intervention-mode";

/** ADR-041 P1 — proactive ticks enter table session actor when IJS + actor are on. */
export function resolveInterventionActorIngress(
  config: ConciergeConfig,
  actorInfraReady: boolean
): boolean {
  return (
    isInterventionJournalActive(config) &&
    resolveTableSessionActorEnabled(config, actorInfraReady)
  );
}
