import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { shouldNotifyTrialEnding } from "@/lib/billing/trial";
import { evaluateUsageAgainstLimits, loadOrgUsageSnapshot } from "@/lib/billing/usage";
import { logger } from "@/lib/logger";

/** Enqueue billing alerts when trial is ending or usage exceeded (idempotent per request). */
export async function maybeEnqueueBillingAlerts(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    planId: string | null;
    trialEndsAt: string | null;
    subscriptionStatus: string | null;
    traceId?: string;
  }
): Promise<void> {
  const traceId = input.traceId ?? `billing-${Date.now()}`;

  if (
    shouldNotifyTrialEnding(input.trialEndsAt, input.subscriptionStatus) &&
    input.locationId
  ) {
    const daysLeft = Math.ceil(
      (new Date(input.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    try {
      await enqueueOutboxEvents(admin, [
        {
          aggregate_type: "session",
          aggregate_id: input.orgId,
          domain: "billing",
          event_type: "billing.trial_ending",
          payload: {
            orgId: input.orgId,
            locationId: input.locationId,
            daysLeft,
            traceId,
          },
        },
      ]);
    } catch (error) {
      logger.warn("billing.trial_ending outbox enqueue failed", {
        orgId: input.orgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const { data: locations } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("is_active", true);

  const locationIds = ((locations ?? []) as Array<{ id: string }>).map((l) => l.id);
  const usage = await loadOrgUsageSnapshot(admin, input.orgId, locationIds);
  const evaluation = evaluateUsageAgainstLimits(usage, input.planId);

  if (evaluation.anyExceeded && input.locationId) {
    try {
      await enqueueOutboxEvents(admin, [
        {
          aggregate_type: "session",
          aggregate_id: input.orgId,
          domain: "billing",
          event_type: "billing.usage_exceeded",
          payload: {
            orgId: input.orgId,
            locationId: input.locationId,
            exceededKeys: evaluation.exceededKeys,
            traceId,
          },
        },
      ]);
    } catch (error) {
      logger.warn("billing.usage_exceeded outbox enqueue failed", {
        orgId: input.orgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
