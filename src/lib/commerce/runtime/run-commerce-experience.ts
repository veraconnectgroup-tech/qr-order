import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import { finalizeCommerceExperienceCommand } from "@/lib/commerce/runtime/finalize-command-rpc";
import {
  commerceIdempotencyKey,
  resolveCommerceIntent,
} from "@/lib/commerce/runtime/resolve-commerce-intent";
import type {
  CommerceTrigger,
  RunCommerceExperienceOpts,
  RunCommerceExperienceResult,
} from "@/lib/commerce/runtime/types";
import {
  enqueueCommerceExperienceSignal,
  isTableSessionActorInfrastructureReady,
} from "@/lib/denis/actor/table-session-actor";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { resolveTableSessionActorEnabled } from "@/lib/denis/config/rollout";
import { logger } from "@/lib/logger";
import { scheduleOutboxProcess } from "@/lib/outbox/schedule-process";
import type { SupabaseClient } from "@supabase/supabase-js";

export type {
  CommerceTrigger,
  GuestCommerceCommand,
  RunCommerceExperienceOpts,
  RunCommerceExperienceResult,
} from "@/lib/commerce/runtime/types";

type OrderCommerceRow = {
  id: string;
  session_id: string | null;
  location_id: string;
  payment_status: string;
  payment_method: string;
  total: number;
  tip_amount: number | null;
};

async function loadOrderForCommerce(
  admin: SupabaseClient,
  orderId: string
): Promise<
  | {
      order: OrderCommerceRow;
      orgId: string;
    }
  | null
> {
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, session_id, location_id, payment_status, payment_method, total, tip_amount"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const orderRow = order as OrderCommerceRow;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (!location) return null;

  return {
    order: orderRow,
    orgId: (location as { org_id: string }).org_id,
  };
}

async function loadSessionContext(
  admin: SupabaseClient,
  sessionId: string
): Promise<{ orgId: string; locationId: string } | null> {
  const { data: session } = await admin
    .from("table_sessions")
    .select("location_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return null;

  const locationId = (session as { location_id: string }).location_id;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .single();

  if (!location) return null;

  return {
    orgId: (location as { org_id: string }).org_id,
    locationId,
  };
}

/**
 * ADR-014: sole commerce experience entry for upstream facts and guest commands.
 * Never blocks order/fiscal paths — callers should fire-and-forget on deferrable steps.
 *
 * ADR-019 Phase E: payment_settled / order_delivered route through Table Session Actor
 * when Redis is available (ADR-013 triggers as Denis signals only).
 */
export async function runCommerceExperience(
  admin: SupabaseClient,
  trigger: CommerceTrigger,
  opts: RunCommerceExperienceOpts = {}
): Promise<RunCommerceExperienceResult> {
  void DEFAULT_COMMERCE_POLICY;

  if (
    !opts.skipActorEnqueue &&
    (trigger.kind === "payment_settled" || trigger.kind === "order_delivered")
  ) {
    const loaded = await loadOrderForCommerce(admin, trigger.orderId);
    if (loaded?.order.session_id) {
      const config = await loadConciergeConfigForLocation(loaded.order.location_id);
      const actorEnabled = resolveTableSessionActorEnabled(
        config,
        isTableSessionActorInfrastructureReady()
      );
      if (actorEnabled) {
        const idempotencyKey = commerceIdempotencyKey(trigger, opts);
        await enqueueCommerceExperienceSignal(
          loaded.order.session_id,
          idempotencyKey,
          {
            triggerKind: trigger.kind,
            orderId: trigger.orderId,
            traceId: opts.traceId,
            idempotencyKey,
          }
        );
        return { eventId: null, skipped: false };
      }
    }
  }

  let sessionId: string | null = null;
  let orgId: string | null = null;
  let locationId: string | null = null;
  let orderId: string | null = null;
  let intentContext: Parameters<typeof resolveCommerceIntent>[1] | null = null;

  if (trigger.kind === "payment_settled" || trigger.kind === "order_delivered") {
    const loaded = await loadOrderForCommerce(admin, trigger.orderId);
    if (!loaded) {
      return { eventId: null, skipped: true, reason: "order_not_found" };
    }

    if (!loaded.order.session_id) {
      return { eventId: null, skipped: true, reason: "no_session" };
    }

    sessionId = loaded.order.session_id;
    orgId = loaded.orgId;
    locationId = loaded.order.location_id;
    orderId = loaded.order.id;
    intentContext = {
      paymentStatus: loaded.order.payment_status,
      paymentMethod: loaded.order.payment_method,
      amountCents:
        Math.round(Number(loaded.order.total) * 100) +
        Math.round(Number(loaded.order.tip_amount ?? 0) * 100),
      orderId: loaded.order.id,
    };
  } else if (trigger.kind === "guest_command") {
    const sessionCtx = await loadSessionContext(admin, trigger.sessionId);
    if (!sessionCtx) {
      return { eventId: null, skipped: true, reason: "session_not_found" };
    }

    sessionId = trigger.sessionId;
    orgId = sessionCtx.orgId;
    locationId = sessionCtx.locationId;

    const payloadOrderId = trigger.command.payload.orderId;
    orderId = typeof payloadOrderId === "string" ? payloadOrderId : null;

    intentContext = {
      paymentStatus: "paid",
      paymentMethod: "unknown",
      amountCents: 0,
      orderId: orderId ?? "",
    };
  } else {
    return { eventId: null, skipped: true, reason: "unsupported_trigger" };
  }

  const intent = resolveCommerceIntent(trigger, intentContext!);
  if (intent.type === "none") {
    return { eventId: null, skipped: true, reason: intent.reason };
  }

  const idempotencyKey = commerceIdempotencyKey(trigger, opts);

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: orgId!,
    locationId: locationId!,
    sessionId: sessionId!,
    orderId,
    commandType: intent.commandType,
    eventType: intent.eventType,
    payload: intent.payload,
    idempotencyKey,
    traceId: opts.traceId,
  });

  if (!result.ok) {
    logger.warn("runCommerceExperience finalize failed", {
      trigger: trigger.kind,
      sessionId,
      orderId,
      traceId: opts.traceId,
      code: result.code,
    });
    return {
      eventId: null,
      skipped: true,
      reason: result.code ?? "finalize_failed",
    };
  }

  scheduleOutboxProcess();

  return { eventId: result.eventId, skipped: false };
}
