import type { EvalSuiteReport } from "@/lib/denis/eval/types";
import { logger } from "@/lib/logger";
import { parseEvalRunIdRow } from "@/lib/supabase/parse-eval-rows";
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

export type PersistEdgeCaseReviewInput = {
  scenarioId: string;
  sessionId: string;
  guestMessage: string;
  promotedBy?: string;
};

/** Store admin edge-case promotion as an eval audit row. */
export async function persistAdminEdgeCaseReview(
  admin: SupabaseClient,
  input: PersistEdgeCaseReviewInput
): Promise<PersistEvalRunResult> {
  const { data, error } = await admin
    .from("denis_eval_runs" as never)
    .insert({
      source: "admin",
      git_sha: null,
      scenario_count: 1,
      passed: 0,
      failed: 0,
      ok: true,
      shadow_parity_threshold: null,
      results: [
        {
          scenarioId: input.scenarioId,
          sessionId: input.sessionId,
          guestMessage: input.guestMessage,
          promotedBy: input.promotedBy ?? "admin",
          type: "edge_case_review",
        },
      ],
    } as never)
    .select("id")
    .single();

  const row = parseEvalRunIdRow(data);
  if (error || !row?.id) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }
  return { ok: true, id: row.id };
}

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

  const row = parseEvalRunIdRow(data);
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
