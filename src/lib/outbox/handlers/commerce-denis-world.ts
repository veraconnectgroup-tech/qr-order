import type { CommerceDenisWorldPayload } from "@/lib/denis/ingress/world-types";
import {
  enqueueWorldSignal,
  isTableSessionActorInfrastructureReady,
} from "@/lib/denis/actor/table-session-actor";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { resolveTableSessionActorEnabled } from "@/lib/denis/config/rollout";
import { runDenisWorldSignal } from "@/lib/denis/runtime/run-denis-world-signal";

function worldSignalId(payload: CommerceDenisWorldPayload): string {
  return `world:${payload.orderId}:${payload.signal}:${payload.status}`;
}

export async function handleCommerceDenisWorld(
  payload: Record<string, unknown>
): Promise<void> {
  const parsed = payload as CommerceDenisWorldPayload;
  if (parsed.sessionId && parsed.locationId) {
    const config = await loadConciergeConfigForLocation(parsed.locationId);
    const actorEnabled = resolveTableSessionActorEnabled(
      config,
      isTableSessionActorInfrastructureReady()
    );
    if (actorEnabled) {
      await enqueueWorldSignal(
        parsed.sessionId,
        worldSignalId(parsed),
        parsed
      );
      return;
    }
  }

  await runDenisWorldSignal(payload);
}

export type { CommerceDenisWorldPayload };
