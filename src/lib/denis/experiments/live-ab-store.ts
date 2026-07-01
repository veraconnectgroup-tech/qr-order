import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { applyLiveAbConfig } from "@/lib/denis/experiments/apply-live-ab-config";
import {
  assignSessionVariant,
  type Experiment,
  type ExperimentMetric,
} from "@/lib/denis/experiments/live-ab";
import { logger } from "@/lib/logger";

export type LiveAbExperimentRow = {
  id: string;
  location_id: string;
  name: string;
  metric: ExperimentMetric;
  variant_a_config: PartialConciergeConfig;
  variant_b_config: PartialConciergeConfig;
  traffic_split: number;
  min_sessions: number;
  auto_apply: boolean;
  owner_approved_apply: boolean;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "stopped";
  winner: "A" | "B" | "inconclusive" | null;
  result: unknown;
};

function rowToExperiment(row: LiveAbExperimentRow): Experiment {
  return {
    id: row.id,
    metric: row.metric,
    variantA: row.variant_a_config,
    variantB: row.variant_b_config,
    trafficSplit: Number(row.traffic_split),
    minSessions: row.min_sessions,
    startedAt: row.started_at,
    status: row.status,
  };
}

export async function loadActiveLiveAbExperiment(
  admin: SupabaseClient,
  locationId: string
): Promise<LiveAbExperimentRow | null> {
  const { data, error } = await admin
    .from("denis_ab_experiments" as never)
    .select("*")
    .eq("location_id", locationId)
    .eq("status", "running")
    .maybeSingle();

  if (error) {
    logger.warn("denis_ab_experiments load failed", {
      locationId,
      error: error.message,
    });
    return null;
  }

  return (data as LiveAbExperimentRow | null) ?? null;
}

export async function ensureLiveAbSessionAssignment(
  admin: SupabaseClient,
  input: {
    experiment: LiveAbExperimentRow;
    sessionToken: string;
  }
): Promise<"A" | "B"> {
  const variant = assignSessionVariant(
    rowToExperiment(input.experiment),
    input.sessionToken
  );

  const { error } = await admin.from("denis_ab_session_assignments" as never).upsert(
    {
      experiment_id: input.experiment.id,
      session_token: input.sessionToken,
      variant,
    } as never,
    { onConflict: "experiment_id,session_token", ignoreDuplicates: true }
  );

  if (error) {
    logger.warn("denis_ab_session_assignments upsert failed", {
      experimentId: input.experiment.id,
      error: error.message,
    });
  }

  return variant;
}

export async function resolveLiveAbConfigForSession(
  admin: SupabaseClient,
  input: {
    locationId: string;
    sessionToken: string | null | undefined;
    baseConfig: import("@/lib/denis/config/concierge-config.schema").ConciergeConfig;
  }
) {
  const token = input.sessionToken?.trim();
  if (!token) {
    return applyLiveAbConfig(input.baseConfig, null, null);
  }

  const row = await loadActiveLiveAbExperiment(admin, input.locationId);
  if (!row) {
    return applyLiveAbConfig(input.baseConfig, null, null);
  }

  await ensureLiveAbSessionAssignment(admin, {
    experiment: row,
    sessionToken: token,
  });

  return applyLiveAbConfig(
    input.baseConfig,
    rowToExperiment(row),
    token
  );
}

export async function recordLiveAbSessionMetrics(
  admin: SupabaseClient,
  input: {
    locationId: string;
    sessionToken: string;
    converted: boolean;
    orderValueCents: number;
    upsellAccepted: boolean;
    minutesToFirstOrder: number | null;
  }
): Promise<void> {
  const experiment = await loadActiveLiveAbExperiment(admin, input.locationId);
  if (!experiment) return;

  const { error } = await admin
    .from("denis_ab_session_assignments" as never)
    .update({
      converted: input.converted,
      order_value_cents: input.orderValueCents,
      upsell_accepted: input.upsellAccepted,
      minutes_to_first_order: input.minutesToFirstOrder,
    } as never)
    .eq("experiment_id", experiment.id)
    .eq("session_token", input.sessionToken);

  if (error) {
    logger.warn("denis_ab_session metrics update failed", {
      locationId: input.locationId,
      error: error.message,
    });
  }
}
