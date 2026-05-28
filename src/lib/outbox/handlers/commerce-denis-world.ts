import type { CommerceDenisWorldPayload } from "@/lib/denis/ingress/world-types";
import {
  enqueueWorldSignal,
  isTableSessionActorEnabled,
} from "@/lib/denis/actor/table-session-actor";
import { runDenisWorldSignal } from "@/lib/denis/runtime/run-denis-world-signal";

function worldSignalId(payload: CommerceDenisWorldPayload): string {
  return `world:${payload.orderId}:${payload.signal}:${payload.status}`;
}

export async function handleCommerceDenisWorld(
  payload: Record<string, unknown>
): Promise<void> {
  if (isTableSessionActorEnabled()) {
    const parsed = payload as CommerceDenisWorldPayload;
    if (parsed.sessionId) {
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
