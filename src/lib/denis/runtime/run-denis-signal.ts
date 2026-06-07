import { apiError } from "@/lib/api-response";
import {
  enqueueGuestSignalAndWait,
  GUEST_SIGNAL_TEMPLATE_WAIT_MS,
  isTableSessionActorInfrastructureReady,
  resolveGuestSignalWaitMs,
  signalResultToResponse,
} from "@/lib/denis/actor/table-session-actor";
import { logger } from "@/lib/logger";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { resolveTableSessionActorEnabled } from "@/lib/denis/config/rollout";
import { executeDenisSignalCore } from "@/lib/denis/runtime/execute-denis-signal-core";
import { resolveSignalContext } from "@/lib/denis/runtime/resolve-signal-context";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDenisSignal } from "@/lib/denis/ingress/normalize-signal";

function resolveSignalId(rawBody: unknown): string {
  if (!rawBody || typeof rawBody !== "object") {
    return createTurnTraceId();
  }
  const candidate = (rawBody as { signalId?: string }).signalId;
  return typeof candidate === "string" && candidate.trim().length >= 8
    ? candidate.trim()
    : createTurnTraceId();
}

/** ADR-019 Phase C/E — unified guest write ingress. */
export async function runDenisSignal(rawBody: unknown): Promise<Response> {
  const normalized = normalizeDenisSignal(rawBody);
  if (!normalized.ok) {
    return apiError("Invalid signal.", 400);
  }

  const admin = createAdminClient();
  const resolved = await resolveSignalContext(admin, normalized.signal.request);
  if (!resolved.ok) {
    return apiError(resolved.error, resolved.status);
  }

  const { tableSessionId, locationId } = resolved.ctx;
  const config = await loadConciergeConfigForLocation(locationId);
  const actorEnabled = resolveTableSessionActorEnabled(
    config,
    isTableSessionActorInfrastructureReady()
  );

  if (!actorEnabled || !tableSessionId) {
    return executeDenisSignalCore(rawBody);
  }

  const signalId = resolveSignalId(rawBody);
  const bodyWithId =
    rawBody && typeof rawBody === "object"
      ? { ...(rawBody as object), signalId }
      : rawBody;

  const result = await enqueueGuestSignalAndWait(
    tableSessionId,
    signalId,
    bodyWithId
  );

  if (!result) {
    const isTemplateSla =
      resolveGuestSignalWaitMs(bodyWithId) === GUEST_SIGNAL_TEMPLATE_WAIT_MS;
    logger.warn("Table session actor SLA timeout", {
      signalId,
      tableSessionId,
      templateSla: isTemplateSla,
    });
    if (isTemplateSla) {
      return executeDenisSignalCore(bodyWithId);
    }
    return signalResultToResponse(null);
  }

  return signalResultToResponse(result);
}
