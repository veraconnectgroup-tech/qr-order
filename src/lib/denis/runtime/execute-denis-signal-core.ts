import { apiError, apiSuccess } from "@/lib/api-response";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import { executeDenisPaymentHandoff } from "@/lib/denis/acl/execute-denis-payment-handoff";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import type { DenisSignalRequest } from "@/lib/denis/ingress/signal-types";
import type { NormalizedDenisSignal } from "@/lib/denis/ingress/signal-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { loadTableSessionView } from "@/lib/denis/loop/load-table-session-view";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { executeActPhase } from "@/lib/denis/runtime/act/execute-act-phase";
import {
  handoffActEnabled,
  resolveActHandoffOutcome,
} from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import { runDenisSense } from "@/lib/denis/runtime/run-denis-sense";
import { runDenisTurn } from "@/lib/denis/runtime/run-denis-turn";
import {
  resolveSignalContext,
  type ResolvedSignalContext,
} from "@/lib/denis/runtime/resolve-signal-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function signalMessage(request: DenisSignalRequest): string {
  if (request.type === "message") return request.text;
  if (request.type === "chip") return request.label;
  return "";
}

function buildTurnBody(
  request: DenisSignalRequest,
  ctx: ResolvedSignalContext,
  normalized: NormalizedDenisSignal
) {
  return {
    locationId: ctx.locationId,
    tableId: ctx.tableId,
    sessionToken: ctx.aiContextToken,
    tableSessionToken: ctx.guestSessionToken ?? undefined,
    message: signalMessage(request),
    language: ctx.language,
    sessionId: request.aiSessionId,
    deviceFingerprint: request.deviceFingerprint,
    deviceToken: request.deviceToken,
    manualCartSnapshot: request.manualCartSnapshot,
    allowOrdering: request.allowOrdering,
    browsingContext: request.browsingContext,
    preferences: request.preferences,
    structuredIntent: normalized.structuredIntent,
    handoffPaymentMethod: normalized.handoffPaymentMethod,
    inputSurface: normalized.channel === "voice" ? "voice" : "chat",
    includeOrderContext:
      request.type === "message" ? request.includeOrderContext : undefined,
  };
}

async function maybeLoadView(
  admin: SupabaseClient,
  ctx: ResolvedSignalContext
) {
  if (!ctx.tableSessionId) return null;

  const { data: venueRow } = await admin
    .from("locations")
    .select("organization:organizations!inner(name)")
    .eq("id", ctx.locationId)
    .maybeSingle();

  const venueName =
    (venueRow as { organization?: { name?: string } } | null)?.organization
      ?.name ?? "";

  return loadTableSessionView(admin, {
    sessionId: ctx.tableSessionId,
    tableId: ctx.tableId,
    locationId: ctx.locationId,
    tableToken: ctx.tableToken,
    venueName,
  });
}

async function runHandoffSignal(
  admin: SupabaseClient,
  request: DenisSignalRequest,
  ctx: ResolvedSignalContext,
  normalized: NormalizedDenisSignal,
  signalId: string
): Promise<Response> {
  const config = await loadConciergeConfigForLocation(ctx.locationId);
  const message = signalMessage(request);
  const reflexTurn = planTurnWithReflex({
    config,
    message,
    flowNodeId:
      normalized.structuredIntent === "HANDOFF_PAY"
        ? "handoff_pay"
        : "handoff_waiter",
    cartState: emptyCartState(),
    structuredIntent: normalized.structuredIntent,
    handoffPaymentMethod: normalized.handoffPaymentMethod,
  });

  let actOutcome = null;

  if (handoffActEnabled(config) && reflexTurn.handoffCommand) {
    const actPhase = await executeActPhase({
      config,
      reflexTurn,
      aiSessionId: request.aiSessionId,
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      tableToken: ctx.tableToken,
      sessionToken: ctx.guestSessionToken ?? undefined,
      deviceFingerprint: request.deviceFingerprint,
      deviceToken: request.deviceToken,
    });
    actOutcome = resolveActHandoffOutcome(actPhase, ctx.language);
  }

  if (!actOutcome?.attempted || !actOutcome.overrideLegacy) {
    if (normalized.structuredIntent === "HANDOFF_PAY") {
      if (!ctx.guestSessionToken) {
        return apiError("session_required", 400);
      }
      const payment = await executeDenisPaymentHandoff(admin, {
        tableId: ctx.tableId,
        locationId: ctx.locationId,
        sessionToken: ctx.guestSessionToken,
        paymentMethod: normalized.handoffPaymentMethod ?? null,
      });
      if (!payment.ok) {
        return apiError(payment.error, 400);
      }
    } else {
      const waiter = await executeDenisWaiterHandoff(admin, {
        tableId: ctx.tableId,
        locationId: ctx.locationId,
        tableToken: ctx.tableToken,
        sessionToken: ctx.guestSessionToken,
      });
      if (!waiter.ok) {
        return apiError(waiter.error, 400);
      }
    }
  }

  const loaded = await maybeLoadView(admin, ctx);

  return apiSuccess({
    signalId,
    ingested: true,
    handoff: actOutcome,
    message: actOutcome?.guestMessage ?? null,
    viewVersion: loaded?.view.version,
    view: loaded?.view,
  });
}

function resolveSignalId(rawBody: unknown): string {
  if (!rawBody || typeof rawBody !== "object") {
    return createTurnTraceId();
  }
  const candidate = (rawBody as { signalId?: string }).signalId;
  return typeof candidate === "string" && candidate.trim().length >= 8
    ? candidate.trim()
    : createTurnTraceId();
}

/** Core guest signal execution — used by HTTP ingress and Table Session Actor (Phase C/E). */
export async function executeDenisSignalCore(rawBody: unknown): Promise<Response> {
  const { normalizeDenisSignal } = await import(
    "@/lib/denis/ingress/normalize-signal"
  );
  const normalized = normalizeDenisSignal(rawBody);
  if (!normalized.ok) {
    return apiError("Invalid signal.", 400);
  }

  const signalId = resolveSignalId(rawBody);
  const admin = createAdminClient();
  const resolved = await resolveSignalContext(admin, normalized.signal.request);
  if (!resolved.ok) {
    return apiError(resolved.error, resolved.status);
  }

  const { signal } = normalized;
  const { ctx } = resolved;
  const request = signal.request;

  if (signal.route === "handoff") {
    return runHandoffSignal(admin, request, ctx, signal, signalId);
  }

  if (signal.route === "sense" && request.type === "telemetry") {
    const senseResponse = await runDenisSense({
      locationId: ctx.locationId,
      tableId: ctx.tableId,
      sessionToken: ctx.aiContextToken,
      aiSessionId: request.aiSessionId,
      channel: signal.senseChannel!,
      payload: request.payload,
      manualCartSnapshot: request.manualCartSnapshot,
      deviceFingerprint: request.deviceFingerprint,
    });

    if (senseResponse.status !== 200) {
      return senseResponse;
    }

    const sensePayload = (await senseResponse.json()) as {
      data?: Record<string, unknown>;
    };
    const loaded = await maybeLoadView(admin, ctx);

    return apiSuccess({
      signalId,
      ingested: true,
      sense: sensePayload.data,
      viewVersion: loaded?.view.version,
      view: loaded?.view,
    });
  }

  return runDenisTurn({
    channel: signal.channel,
    rawBody: buildTurnBody(request, ctx, signal),
  });
}
