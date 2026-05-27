import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";
import { persistDenisEvalRun } from "@/lib/denis/eval/persist-eval-run";
import type { EvalSuiteReport } from "@/lib/denis/eval/types";
import type { DenisEvalRunSource } from "@/lib/denis/eval/persist-eval-run";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordEvalSuiteOptions = {
  admin?: SupabaseClient;
  source?: DenisEvalRunSource;
  gitSha?: string | null;
  skipPersist?: boolean;
};

export type RecordEvalSuiteResult = {
  report: EvalSuiteReport;
  persisted: { ok: true; id: string } | { ok: false; error: string } | null;
};

/** Run golden suite; optionally persist to `denis_eval_runs` (M24/M26). */
export async function runEvalSuiteAndMaybePersist(
  options: RecordEvalSuiteOptions = {}
): Promise<RecordEvalSuiteResult> {
  const report = runDenisEvalSuite();

  if (options.skipPersist || !options.admin) {
    return { report, persisted: null };
  }

  const gitSha =
    options.gitSha?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT ||
    null;

  const persisted = await persistDenisEvalRun(options.admin, {
    report,
    source: options.source ?? "ci",
    gitSha,
  });

  return { report, persisted };
}
