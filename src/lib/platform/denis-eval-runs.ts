"use server";

import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ScenarioRunResult } from "@/lib/denis/eval/types";
import {
  parseDenisEvalRunDetailRow,
  parseDenisEvalRunRows,
} from "@/lib/supabase/parse-eval-rows";
import { createAdminClient } from "@/lib/supabase/admin";

export type DenisEvalRunRow = {
  id: string;
  source: string;
  gitSha: string | null;
  scenarioCount: number;
  passed: number;
  failed: number;
  ok: boolean;
  shadowParityThreshold: number;
  createdAt: string;
};

export async function listRecentDenisEvalRuns(
  limit = 20
): Promise<DenisEvalRunRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("denis_eval_runs" as never)
    .select(
      "id, source, git_sha, scenario_count, passed, failed, ok, shadow_parity_threshold, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  const rows = parseDenisEvalRunRows(data);

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    gitSha: row.git_sha,
    scenarioCount: row.scenario_count,
    passed: row.passed,
    failed: row.failed,
    ok: row.ok,
    shadowParityThreshold: Number(row.shadow_parity_threshold),
    createdAt: row.created_at,
  }));
}

export type DenisEvalRunDetail = DenisEvalRunRow & {
  results: ScenarioRunResult[];
};

export async function getDenisEvalRunById(
  runId: string
): Promise<DenisEvalRunDetail | null> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("denis_eval_runs" as never)
    .select(
      "id, source, git_sha, scenario_count, passed, failed, ok, shadow_parity_threshold, created_at, results"
    )
    .eq("id", runId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = parseDenisEvalRunDetailRow(data);

  return {
    id: row.id,
    source: row.source,
    gitSha: row.git_sha,
    scenarioCount: row.scenario_count,
    passed: row.passed,
    failed: row.failed,
    ok: row.ok,
    shadowParityThreshold: Number(row.shadow_parity_threshold),
    createdAt: row.created_at,
    results: Array.isArray(row.results) ? row.results : [],
  };
}
