import {
  enqueueProactiveTickSignal,
  isTableSessionActorInfrastructureReady,
} from "@/lib/denis/actor/table-session-actor";
import type { QueuedProactiveTickPayload } from "@/lib/denis/actor/types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveInterventionActorIngress } from "@/lib/denis/config/resolve-intervention-actor-ingress";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import { runProactiveSessionTick } from "@/lib/denis/runtime/run-proactive-session-tick";
import type { SupabaseClient } from "@supabase/supabase-js";

/** ADR-041 P1 — route proactive tick through actor when IJS actor ingress is enabled. */
export async function enqueueOrRunProactiveSessionTick(
  admin: SupabaseClient,
  input: QueuedProactiveTickPayload & { config: ConciergeConfig }
): Promise<GuestProactiveNudge | null> {
  const actorReady = isTableSessionActorInfrastructureReady();
  if (resolveInterventionActorIngress(input.config, actorReady)) {
    await enqueueProactiveTickSignal(input.tableSessionId, input.traceId, {
      tableSessionId: input.tableSessionId,
      source: input.source,
      traceId: input.traceId,
      preambleDone: input.preambleDone,
    });
    return null;
  }

  return runProactiveSessionTick(admin, {
    tableSessionId: input.tableSessionId,
    source: input.source,
    traceId: input.traceId,
    preambleDone: input.preambleDone,
  });
}
