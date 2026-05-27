import type { EvalSuiteReport } from "@/lib/denis/eval/types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DenisEvalRunSource = "ci" | "manual" | "admin";

export type PersistEvalRunInput = {
  report: EvalSuiteReport;
  source?: DenisEvalRunSource;
  gitSha?: string | null;
};

export type PersistEvalRunResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Append golden-eval report to `denis_eval_runs` (M24). Never throws. */
export async function persistDenisEvalRun(
  admin: SupabaseClient,
  input: PersistEvalRunInput
): Promise<PersistEvalRunResult> {
  const { report } = input;
  const source = input.source ?? "ci";
  const gitSha = input.gitSha?.trim() || null;

  const { data, error } = await admin
    .from("denis_eval_runs" as never)
    .insert({
      source,
      git_sha: gitSha,
      scenario_count: report.scenarioCount,
      passed: report.passed,
      failed: report.failed,
      ok: report.ok,
      shadow_parity_threshold: report.shadowParityThreshold,
      results: report.results,
    } as never)
    .select("id")
    .single();

  const row = data as unknown as { id: string } | null;
  if (error || !row?.id) {
    logger.warn("Denis eval run persist failed", {
      source,
      error: error?.message ?? "no id",
    });
    return {
      ok: false,
      error: error?.message ?? "Insert failed",
    };
  }

  return { ok: true, id: row.id };
}
