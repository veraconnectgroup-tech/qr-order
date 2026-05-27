/**
 * Run golden eval suite and optionally persist to denis_eval_runs.
 * Usage: pnpm eval:denis:record
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; DENIS_SKIP_EVAL_PERSIST=1 to skip DB write
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { runEvalSuiteAndMaybePersist } from "@/lib/denis/eval/record-eval-suite";
import { createAdminClient } from "@/lib/supabase/admin";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("No .env.local — using process.env");
  }
}

async function main() {
  loadEnvLocal();

  const skipPersist = process.env.DENIS_SKIP_EVAL_PERSIST === "1";
  const hasSupabase =
    Boolean(process.env.SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { report, persisted } = await runEvalSuiteAndMaybePersist({
    admin:
      !skipPersist && hasSupabase ? createAdminClient() : undefined,
    source: "ci",
    skipPersist: skipPersist || !hasSupabase,
  });

  if (!report.ok) {
    const failed = report.results.filter((row) => !row.passed);
    console.error("Eval suite failed:", JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  } else {
    console.log(
      `Eval suite ok: ${report.passed}/${report.scenarioCount} scenarios`
    );
  }

  if (!hasSupabase && !skipPersist) {
    console.warn("Skip persist — missing Supabase env");
  } else if (persisted?.ok) {
    console.log(`Recorded eval run ${persisted.id}`);
  } else if (persisted && !persisted.ok) {
    console.warn(`Persist skipped: ${persisted.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
