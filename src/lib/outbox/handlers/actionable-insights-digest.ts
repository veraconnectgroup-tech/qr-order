import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchActionableInsightsForLocation } from "@/lib/dashboard/dispatch-actionable-insights";
import { logger } from "@/lib/logger";

export type ActionableInsightsOutboxPayload = {
  orgId: string;
  locationId: string;
  locationName?: string;
  insightDate?: string;
  range?: "today" | "week";
};

/** Outbox email delivery for owner actionable insights digest. */
export async function handleActionableInsightsDigest(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as ActionableInsightsOutboxPayload;

  if (!data.orgId || !data.locationId) {
    throw new Error("actionable_insights missing orgId or locationId");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient() as SupabaseClient;

  const result = await dispatchActionableInsightsForLocation(admin, {
    orgId: data.orgId,
    locationId: data.locationId,
    locationName: data.locationName ?? "Location",
    insightDate: data.insightDate ?? new Date().toISOString().slice(0, 10),
    range: data.range ?? "today",
  });

  logger.info("Outbox actionable_insights delivered", {
    orgId: data.orgId,
    locationId: data.locationId,
    ...result,
  });
}
