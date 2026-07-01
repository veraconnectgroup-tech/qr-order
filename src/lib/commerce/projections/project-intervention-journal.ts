import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import { loadCommerceSessionContext } from "@/lib/commerce/projections/load-commerce-session-context";
import { finalizeCommerceExperienceCommand } from "@/lib/commerce/runtime/finalize-command-rpc";
import type {
  InterventionCommittedPayload,
  InterventionDeclinedPayload,
  InterventionExpiredPayload,
  InterventionJournalPayload,
  InterventionSupersededPayload,
} from "@/lib/denis/cognition/intervention/intervention-types";
import { logger } from "@/lib/logger";
import { scheduleOutboxProcess } from "@/lib/outbox/schedule-process";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Project IJS evaluation → commerce_experience_events (ADR-041). */
export async function projectInterventionEvaluatedToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    payload: InterventionJournalPayload;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const idempotencyKey = `denis:intervention:${input.payload.interventionId}:evaluated`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    commandType: COMMERCE_COMMAND_TYPES.recordInterventionEvaluated,
    eventType: COMMERCE_EVENT_TYPES.interventionEvaluated,
    payload: {
      ...input.payload,
      nudgeKind: input.payload.updsKind,
    },
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectInterventionEvaluatedToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}

/** Project IJS silence → commerce_experience_events (ADR-041 P2). */
export async function projectInterventionDeclinedToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    payload: InterventionDeclinedPayload;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const idempotencyKey = `denis:intervention:${input.payload.interventionId}:declined`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    commandType: COMMERCE_COMMAND_TYPES.recordInterventionDeclined,
    eventType: COMMERCE_EVENT_TYPES.interventionDeclined,
    payload: {
      ...input.payload,
      nudgeKind: input.payload.updsKind,
    },
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectInterventionDeclinedToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}

/** Project successful IJS speak → commerce_experience_events (ADR-041 P2). */
export async function projectInterventionCommittedToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    payload: InterventionCommittedPayload;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const idempotencyKey = `denis:intervention:${input.payload.interventionId}:committed`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    commandType: COMMERCE_COMMAND_TYPES.recordInterventionCommitted,
    eventType: COMMERCE_EVENT_TYPES.interventionCommitted,
    payload: {
      ...input.payload,
      nudgeKind: input.payload.updsKind,
    },
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectInterventionCommittedToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}

/** Project defer expiry → commerce_experience_events (ADR-041 P4). */
export async function projectInterventionExpiredToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    payload: InterventionExpiredPayload;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const idempotencyKey = `denis:intervention:${input.payload.interventionId}:expired`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    commandType: COMMERCE_COMMAND_TYPES.recordInterventionExpired,
    eventType: COMMERCE_EVENT_TYPES.interventionExpired,
    payload: input.payload,
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectInterventionExpiredToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}

/** Project superseded defer → commerce_experience_events (ADR-041 P4). */
export async function projectInterventionSupersededToCommerce(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    payload: InterventionSupersededPayload;
  }
): Promise<void> {
  const ctx = await loadCommerceSessionContext(admin, {
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
  });
  if (!ctx) return;

  const idempotencyKey = `denis:intervention:${input.payload.interventionId}:superseded`;

  const result = await finalizeCommerceExperienceCommand(admin, {
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    sessionId: ctx.sessionId,
    commandType: COMMERCE_COMMAND_TYPES.recordInterventionSuperseded,
    eventType: COMMERCE_EVENT_TYPES.interventionSuperseded,
    payload: input.payload,
    idempotencyKey,
    traceId: input.traceId,
  });

  if (!result.ok) {
    logger.warn("projectInterventionSupersededToCommerce failed", {
      aiSessionId: input.aiSessionId,
      idempotencyKey,
      traceId: input.traceId,
    });
    return;
  }

  scheduleOutboxProcess();
}
