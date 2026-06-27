import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  parsePartialConciergeConfig,
  type ConciergePilotCutover,
  type PilotCutoverStage,
} from "@/lib/denis/config/concierge-config.schema";
import {
  countLocationCompletedSessions,
  RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS,
} from "@/lib/denis/config/count-location-completed-sessions";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  buildPilotStagePatch,
  inferPilotStageFromRollout,
  initialPilotCutoverStage,
  nextPilotCutoverStage,
  pilotCutoverStageLabel,
} from "@/lib/denis/config/pilot-cutover-ladder";

export type PilotReadinessItem = {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail?: string;
};

export type PilotReadiness = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  checks: PilotReadinessItem[];
  evalPassRatePct: number;
  actOrderErrors7d: number;
  completedSessions: number;
  currentStage: PilotCutoverStage | null;
  nextStage: PilotCutoverStage | null;
  hasRollbackSnapshot: boolean;
  pilotCutover: ConciergePilotCutover | null;
};

export type PilotReadinessDeps = {
  evalPassRatePct: number;
  actOrderErrors7d?: number;
  completedSessions?: number;
  staffCopilotAcknowledged?: boolean;
};

const MIN_EVAL_PASS_RATE_PCT = 95;

async function countDenisActOrderErrors7d(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", locationId)
    .gte("created_at", since);

  const sessionIds = (sessions ?? []).map((row) => (row as { id: string }).id);
  if (sessionIds.length === 0) return 0;

  const { data: events } = await admin
    .from("denis_timeline")
    .select("payload")
    .in("ai_session_id", sessionIds)
    .eq("event_type", "skill.executed")
    .gte("created_at", since);

  let errors = 0;
  for (const row of events ?? []) {
    const payload = (row as { payload: unknown }).payload;
    if (!payload || typeof payload !== "object") continue;
    const record = payload as Record<string, unknown>;
    if (record.skillId !== "order.submit") continue;
    if (record.ok === false || record.error) errors += 1;
  }

  return errors;
}

function item(
  id: string,
  label: string,
  passed: boolean,
  blocking: boolean,
  detail?: string
): PilotReadinessItem {
  return { id, label, passed, blocking, detail };
}

export async function loadLocationPilotCutover(
  admin: SupabaseClient,
  locationId: string
): Promise<ConciergePilotCutover | null> {
  const { data } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  const partial = parsePartialConciergeConfig(
    (data as { ai_concierge_config: unknown } | null)?.ai_concierge_config ?? null
  );
  return partial?.pilotCutover ?? null;
}

/** H1 — venue readiness before pilot cutover / ladder advance. */
export async function checkPilotReadiness(
  admin: SupabaseClient,
  locationId: string,
  input?: {
    config?: ConciergeConfig;
    pilotCutover?: ConciergePilotCutover | null;
    deps?: PilotReadinessDeps;
    staffCopilotAcknowledged?: boolean;
  }
): Promise<PilotReadiness> {
  const config =
    input?.config ??
    (await loadConciergeConfigForLocation(locationId, { bypassCache: true }));
  const pilotCutover =
    input?.pilotCutover !== undefined
      ? input.pilotCutover
      : await loadLocationPilotCutover(admin, locationId);

  const evalPassRatePct = input?.deps?.evalPassRatePct ?? 0;
  const actOrderErrors7d =
    input?.deps?.actOrderErrors7d ??
    (await countDenisActOrderErrors7d(admin, locationId));
  const completedSessions =
    input?.deps?.completedSessions ??
    (await countLocationCompletedSessions(admin, locationId));

  const staffAck =
    input?.staffCopilotAcknowledged ??
    input?.deps?.staffCopilotAcknowledged ??
    pilotCutover?.staffCopilotAcknowledged ??
    false;

  const currentStage =
    pilotCutover?.stage ??
    inferPilotStageFromRollout({
      mode: config.rollout.mode,
      canaryPercent: config.rollout.canaryPercent,
    });
  const nextStage = nextPilotCutoverStage(currentStage);

  const stagePatch = buildPilotStagePatch(nextStage ?? initialPilotCutoverStage());

  const checks: PilotReadinessItem[] = [
    item(
      "eval-pass-rate",
      `Eval pass rate ≥ ${MIN_EVAL_PASS_RATE_PCT}%`,
      evalPassRatePct >= MIN_EVAL_PASS_RATE_PCT,
      true,
      `${evalPassRatePct}%`
    ),
    item(
      "act-order-errors",
      "0 Denis act order errors (7d)",
      actOrderErrors7d === 0,
      true,
      actOrderErrors7d > 0 ? `${actOrderErrors7d} errors` : undefined
    ),
    item(
      "allergy-guard",
      "Allergy guard active (staff + obligation path)",
      config.proactive.staffAllergy === true,
      true
    ),
    item(
      "rhythm-sessions",
      `Rhythm priors ≥ ${RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS} sessions`,
      completedSessions >= RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS,
      true,
      `${completedSessions} completed sessions`
    ),
    item(
      "floor-graph",
      "Floor graph enabled",
      stagePatch.ops?.floorGraphEnabled === true,
      true
    ),
    item(
      "staff-copilot-reviewed",
      "Staff copilot reviewed by owner",
      staffAck,
      true,
      staffAck ? undefined : "Confirm checklist in admin before Go Live"
    ),
  ];

  if (config.ordering.actDryRun && config.ordering.actSubmitEnabled) {
    checks.push(
      item(
        "act-dry-run",
        "Act submit enabled while dry-run is on",
        false,
        false,
        "Disable dry-run only on final denis_only step"
      )
    );
  }

  const blockers = checks
    .filter((check) => check.blocking && !check.passed)
    .map((check) => check.label);
  const warnings = checks
    .filter((check) => !check.blocking && !check.passed)
    .map((check) => check.label);

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    checks,
    evalPassRatePct,
    actOrderErrors7d,
    completedSessions,
    currentStage,
    nextStage,
    hasRollbackSnapshot: Boolean(pilotCutover?.rollbackSnapshot),
    pilotCutover,
  };
}

export { pilotCutoverStageLabel };
