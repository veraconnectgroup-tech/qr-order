import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  canAutoApplyAbWinner,
  evaluateAbExperiment,
  type AbExperiment,
  type AbSessionMetrics,
} from "@/lib/denis/config/ab-experiment";
import {
  formatExperimentStatusLine,
  type Experiment,
  type ExperimentResult,
  type SessionMetrics,
} from "@/lib/denis/experiments/live-ab";
import {
  loadActiveLiveAbExperiment,
  type LiveAbExperimentRow,
} from "@/lib/denis/experiments/live-ab-store";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { logger } from "@/lib/logger";

export type LiveAbAdminSnapshot = {
  experiment: LiveAbExperimentRow | null;
  result: ExperimentResult | null;
  statusLine: string | null;
  variantALabel: string;
  variantBLabel: string;
  canAutoApply: boolean;
  pendingOwnerApproval: boolean;
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

function rowToAbExperiment(row: LiveAbExperimentRow): AbExperiment {
  return {
    ...rowToExperiment(row),
    autoApply: row.auto_apply,
    ownerApprovedApply: row.owner_approved_apply,
  };
}

function describeVariantPatch(patch: PartialConciergeConfig): string {
  const upsell = patch.upsell;
  if (upsell?.dessertDelayMinutes != null) {
    return `dessertDelayMinutes=${upsell.dessertDelayMinutes}`;
  }
  const proactive = patch.proactive;
  if (proactive?.browseNudgeMinutes != null) {
    return `browseNudgeMinutes=${proactive.browseNudgeMinutes}`;
  }
  if (proactive?.billPromptMinutes != null) {
    return `billPromptMinutes=${proactive.billPromptMinutes}`;
  }
  return "custom config patch";
}

export async function loadLiveAbSessionMetrics(
  admin: SupabaseClient,
  experimentId: string
): Promise<{ A: SessionMetrics[]; B: SessionMetrics[] }> {
  const { data, error } = await admin
    .from("denis_ab_session_assignments" as never)
    .select(
      "session_token, variant, converted, order_value_cents, upsell_accepted, minutes_to_first_order"
    )
    .eq("experiment_id", experimentId);

  if (error) {
    logger.warn("denis_ab_session_assignments load failed", {
      experimentId,
      error: error.message,
    });
    return { A: [], B: [] };
  }

  const rows = (data ?? []) as Array<{
    session_token: string;
    variant: "A" | "B";
    converted: boolean;
    order_value_cents: number;
    upsell_accepted: boolean;
    minutes_to_first_order: number | null;
  }>;

  const A: SessionMetrics[] = [];
  const B: SessionMetrics[] = [];

  for (const row of rows) {
    const metrics: SessionMetrics = {
      sessionToken: row.session_token,
      converted: row.converted,
      orderValueCents: row.order_value_cents,
      upsellAccepted: row.upsell_accepted,
      minutesToFirstOrder: row.minutes_to_first_order,
    };
    if (row.variant === "A") A.push(metrics);
    else B.push(metrics);
  }

  return { A, B };
}

export async function loadLiveAbAdminSnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<LiveAbAdminSnapshot> {
  const experiment = await loadActiveLiveAbExperiment(admin, locationId);
  if (!experiment) {
    return {
      experiment: null,
      result: null,
      statusLine: null,
      variantALabel: "",
      variantBLabel: "",
      canAutoApply: false,
      pendingOwnerApproval: false,
    };
  }

  const { A, B } = await loadLiveAbSessionMetrics(admin, experiment.id);
  const result = evaluateAbExperiment(rowToAbExperiment(experiment), A, B);
  const variantALabel = describeVariantPatch(experiment.variant_a_config);
  const variantBLabel = describeVariantPatch(experiment.variant_b_config);

  const canAutoApply = canAutoApplyAbWinner(rowToAbExperiment(experiment), result);

  return {
    experiment,
    result,
    statusLine: formatExperimentStatusLine(
      experiment.name,
      result,
      variantALabel,
      variantBLabel
    ),
    variantALabel,
    variantBLabel,
    canAutoApply,
    pendingOwnerApproval:
      canAutoApply && !experiment.owner_approved_apply,
  };
}

export async function applyLiveAbWinnerIfReady(
  admin: SupabaseClient,
  locationId: string
): Promise<{ applied: boolean; message: string | null }> {
  const snapshot = await loadLiveAbAdminSnapshot(admin, locationId);
  const experiment = snapshot.experiment;
  const result = snapshot.result;

  if (!experiment || !result) {
    return { applied: false, message: null };
  }

  if (!snapshot.canAutoApply || snapshot.pendingOwnerApproval) {
    return { applied: false, message: null };
  }

  if (result.winner === "inconclusive") {
    return { applied: false, message: null };
  }

  const winningPatch =
    result.winner === "A"
      ? experiment.variant_a_config
      : experiment.variant_b_config;

  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  const currentPartial =
    (locationRow as { ai_concierge_config?: PartialConciergeConfig } | null)
      ?.ai_concierge_config ?? null;

  const merged = mergePartialConciergeConfig(currentPartial, winningPatch);

  const { error: updateError } = await admin
    .from("locations")
    .update({ ai_concierge_config: merged })
    .eq("id", locationId);

  if (updateError) {
    logger.warn("live ab winner apply failed", {
      locationId,
      error: updateError.message,
    });
    return { applied: false, message: null };
  }

  await admin
    .from("denis_ab_experiments" as never)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      winner: result.winner,
      result,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", experiment.id);

  const liftPct = Math.round(result.lift * 100);
  return {
    applied: true,
    message: `Eksperiment zaključen: ${experiment.name} → variant ${result.winner} (+${liftPct}%)`,
  };
}

export function buildLiveAbDigestLines(
  snapshot: LiveAbAdminSnapshot
): string[] {
  if (!snapshot.experiment || !snapshot.result) return [];

  const lines = [snapshot.statusLine ?? ""].filter(Boolean);

  if (snapshot.experiment.status === "completed" && snapshot.experiment.winner) {
    const liftPct = Math.round((snapshot.result.lift ?? 0) * 100);
    lines.push(
      `Eksperiment zaključen: ${snapshot.experiment.name} → ${snapshot.experiment.winner} (+${liftPct}%)`
    );
  }

  return lines;
}

export { loadActiveLiveAbExperiment };
