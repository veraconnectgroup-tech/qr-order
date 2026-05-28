import { apiError } from "@/lib/api-response";
import {
  enqueueGuestSignalAndWait,
  isTableSessionActorEnabled,
  signalResultToResponse,
} from "@/lib/denis/actor/table-session-actor";
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
  if (!isTableSessionActorEnabled()) {
    return executeDenisSignalCore(rawBody);
  }

  const normalized = normalizeDenisSignal(rawBody);
  if (!normalized.ok) {
    return apiError("Invalid signal.", 400);
  }

  const admin = createAdminClient();
  const resolved = await resolveSignalContext(admin, normalized.signal.request);
  if (!resolved.ok) {
    return apiError(resolved.error, resolved.status);
  }

  const { tableSessionId } = resolved.ctx;
  if (!tableSessionId) {
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

  return signalResultToResponse(result);
}
