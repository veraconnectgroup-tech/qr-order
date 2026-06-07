import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import { loadCommerceSessionContext } from "@/lib/commerce/projections/load-commerce-session-context";
import { finalizeCommerceExperienceCommand } from "@/lib/commerce/runtime/finalize-command-rpc";
import type { OfferConversionRecord } from "@/lib/denis/cognition/offer/offer-conversion-types";
import type { NudgeOutcomeRecord } from "@/lib/denis/cognition/offer/nudge-outcome-types";
import type { ProactiveEmittedPayload } from "@/lib/denis/cognition/offer/build-proactive-emitted-payload";
import { logger } from "@/lib/logger";
import { scheduleOutboxProcess } from "@/lib/outbox/schedule-process";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Project Denis proactive emit → commerce_experience_events (ADR-014 / GMM-13). */
export async function projectNudgeEmittedToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    payload: ProactiveEmittedPayload;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const dedupeKey =
    input.payload.dedupeKey ??
    (input.payload.orderId
      ? `${input.payload.kind}:${input.payload.orderId}`
      : input.payload.kind);

  const idempotencyKey = `denis:nudge:${dedupeKey}`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    orderId: input.payload.orderId ?? null,
    commandType: COMMERCE_COMMAND_TYPES.recordNudgeEmitted,
    eventType: COMMERCE_EVENT_TYPES.nudgeEmitted,
    payload: {
      nudgeKind: input.payload.kind,
      productId: input.payload.productId ?? null,
      productName: input.payload.productName ?? null,
      offerResolution: input.payload.offerResolution ?? null,
      offerHash: input.payload.offerHash ?? null,
      dedupeKey,
      source: input.payload.source ?? null,
    },
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectNudgeEmittedToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}

/** Project Denis offer.converted → commerce_experience_events (ADR-014 / GMM-13). */
export async function projectOfferConvertedToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    conversion: OfferConversionRecord;
    dedupeKey: string;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const idempotencyKey = `denis:offer:${input.dedupeKey}`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    commandType: COMMERCE_COMMAND_TYPES.recordOfferConverted,
    eventType: COMMERCE_EVENT_TYPES.offerConverted,
    payload: {
      productId: input.conversion.productId,
      productName: input.conversion.productName,
      nudgeKind: input.conversion.nudgeKind,
      offerResolution: input.conversion.offerResolution,
      emittedAt: input.conversion.emittedAt,
      convertedAt: input.conversion.convertedAt,
      lagSeconds: input.conversion.lagSeconds,
      dedupeKey: input.dedupeKey,
    },
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectOfferConvertedToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}

export async function projectOfferConversionsToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    conversions: OfferConversionRecord[];
  }
): Promise<void> {
  for (const conversion of input.conversions) {
    await projectOfferConvertedToCommerce(admin, {
      aiSessionId: input.aiSessionId,
      tableSessionId: input.tableSessionId,
      traceId: input.traceId,
      conversion,
      dedupeKey: `${conversion.productId}:${conversion.emittedAt}`,
    });
  }
}

/** Project Denis anticipation.resolved → commerce_experience_events (ADR-039 L2). */
export async function projectNudgeOutcomesToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    outcomes: NudgeOutcomeRecord[];
  }
): Promise<void> {
  for (const outcome of input.outcomes) {
    const ctx = await loadCommerceSessionContext(admin, {
      aiSessionId: input.aiSessionId,
      tableSessionId: input.tableSessionId,
    });
    if (!ctx) return;

    const idempotencyKey = `denis:nudge_outcome:${outcome.nudgeId}`;

    const result = await finalizeCommerceExperienceCommand(admin, {
      orgId: ctx.orgId,
      locationId: ctx.locationId,
      sessionId: ctx.sessionId,
      commandType: COMMERCE_COMMAND_TYPES.recordNudgeResolved,
      eventType: COMMERCE_EVENT_TYPES.nudgeResolved,
      payload: {
        nudgeId: outcome.nudgeId,
        nudgeKind: outcome.nudgeKind,
        outcome: outcome.outcome,
        signal: outcome.signal,
        productId: outcome.productId,
        productName: outcome.productName,
        offerResolution: outcome.offerResolution,
        emittedAt: outcome.emittedAt,
        resolvedAt: outcome.resolvedAt,
        lagMs: outcome.lagMs,
      },
      idempotencyKey,
      traceId: input.traceId,
    });

    if (!result.ok) {
      logger.warn("projectNudgeOutcomesToCommerce failed", {
        aiSessionId: input.aiSessionId,
        idempotencyKey,
        traceId: input.traceId,
      });
      continue;
    }

    scheduleOutboxProcess();
  }
}
