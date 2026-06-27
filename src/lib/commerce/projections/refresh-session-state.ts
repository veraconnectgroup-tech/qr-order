import {
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import { upsertAnticipationRollup } from "@/lib/commerce/projections/rollup-anticipation-analytics";
import { upsertVenueRhythmPriors } from "@/lib/commerce/projections/rollup-venue-rhythm-priors";
import { upsertSessionCompletedDailyRollup } from "@/lib/commerce/projections/rollup-session-daily-analytics";
import { upsertOfferUpsellDailyRollup } from "@/lib/commerce/projections/rollup-denis-roi-daily";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

type ProjectionRefreshPayload = {
  commerceEventId?: string;
  sessionId?: string;
  eventType?: string;
};

export async function refreshGuestSessionCommerceState(
  admin: ReturnType<typeof createAdminClient>,
  input: ProjectionRefreshPayload
): Promise<void> {
  if (!input.commerceEventId || !input.sessionId) {
    throw new Error("commerce.projection.refresh missing commerceEventId or sessionId");
  }

  const { data: event, error: eventError } = await admin
    .from("commerce_experience_events" as never)
    .select(
      "id, org_id, location_id, session_id, order_id, event_type, payload, created_at"
    )
    .eq("id", input.commerceEventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(eventError.message);
  }

  if (!event) {
    logger.warn("commerce projection refresh: event not found", {
      commerceEventId: input.commerceEventId,
    });
    return;
  }

  const row = event as {
    org_id: string;
    location_id: string;
    session_id: string;
    order_id: string | null;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  };

  if (row.session_id !== input.sessionId) {
    throw new Error("commerce.projection.refresh session mismatch");
  }

  const patch: Record<string, unknown> = {
    org_id: row.org_id,
    location_id: row.location_id,
    updated_at: new Date().toISOString(),
  };

  if (row.event_type === COMMERCE_EVENT_TYPES.paymentSettled) {
    patch.last_payment_settled_order_id = row.order_id;
    patch.last_payment_settled_at = row.created_at;
  }

  if (row.event_type === COMMERCE_EVENT_TYPES.sessionBillSettled) {
    patch.bill_settled = true;
  }

  if (row.event_type === COMMERCE_EVENT_TYPES.feedbackSubmitted) {
    patch.feedback_submitted = true;
  }

  if (
    row.event_type === COMMERCE_EVENT_TYPES.nudgeEmitted ||
    row.event_type === COMMERCE_EVENT_TYPES.offerConverted ||
    row.event_type === COMMERCE_EVENT_TYPES.nudgeResolved ||
    row.event_type === COMMERCE_EVENT_TYPES.interventionEvaluated ||
    row.event_type === COMMERCE_EVENT_TYPES.interventionDeclined ||
    row.event_type === COMMERCE_EVENT_TYPES.interventionCommitted ||
    row.event_type === COMMERCE_EVENT_TYPES.interventionExpired ||
    row.event_type === COMMERCE_EVENT_TYPES.interventionSuperseded
  ) {
    await upsertAnticipationRollup(admin, {
      orgId: row.org_id,
      locationId: row.location_id,
      eventType: row.event_type,
      createdAt: row.created_at,
      payload: row.payload,
    });

    if (row.event_type === COMMERCE_EVENT_TYPES.offerConverted) {
      const revenue = Number(
        row.payload.revenue ?? row.payload.lineTotal ?? 0
      );
      if (Number.isFinite(revenue) && revenue > 0) {
        await upsertOfferUpsellDailyRollup(admin, {
          orgId: row.org_id,
          locationId: row.location_id,
          createdAt: row.created_at,
          nudgeKind:
            typeof row.payload.nudgeKind === "string"
              ? row.payload.nudgeKind
              : "unknown",
          revenue,
        });
      }
    }
  }

  if (row.event_type === COMMERCE_EVENT_TYPES.sessionCompleted) {
    await upsertVenueRhythmPriors(admin, {
      orgId: row.org_id,
      locationId: row.location_id,
      payload: row.payload,
    });
    await upsertSessionCompletedDailyRollup(admin, {
      orgId: row.org_id,
      locationId: row.location_id,
      eventType: row.event_type,
      createdAt: row.created_at,
      payload: row.payload,
    });
  }

  if (row.event_type === COMMERCE_EVENT_TYPES.orderDelivered && row.order_id) {
    const { upsertPrepTimePriorsFromOrderDelivered } = await import(
      "@/lib/commerce/projections/rollup-prep-time-priors"
    );
    await upsertPrepTimePriorsFromOrderDelivered(admin, {
      orgId: row.org_id,
      locationId: row.location_id,
      orderId: row.order_id,
    });
  }

  const { error: upsertError } = await admin
    .from("guest_session_commerce_state" as never)
    .upsert(
      {
        session_id: row.session_id,
        ...patch,
      } as never,
      { onConflict: "session_id" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  try {
    const { refreshGuestScene } = await import("@/lib/scene/refresh-guest-scene");
    await refreshGuestScene(admin, { sessionId: input.sessionId });
  } catch (err) {
    logger.warn("commerce projection refresh: scene refresh failed", {
      sessionId: input.sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function handleCommerceProjectionRefresh(
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  await refreshGuestSessionCommerceState(admin, payload as ProjectionRefreshPayload);
}
