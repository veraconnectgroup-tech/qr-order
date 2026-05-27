import Link from "next/link";
import { notFound } from "next/navigation";
import { getDenisEvalRunById } from "@/lib/platform/denis-eval-runs";

export default async function DenisEvalRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getDenisEvalRunById(runId);
  if (!run) {
    notFound();
  }

  const failures = run.results.filter((row) => !row.passed);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href="/platform/denis-eval"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Eval runs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          Eval run {run.ok ? "passed" : "failed"}
        </h1>
        <p className="mt-1 font-mono text-xs text-neutral-500">{run.id}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">When</dt>
          <dd className="font-medium">
            {new Date(run.createdAt).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Source</dt>
          <dd className="font-medium">{run.source}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Scenarios</dt>
          <dd className="font-medium">
            {run.passed}/{run.scenarioCount}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Git SHA</dt>
          <dd className="truncate font-mono text-xs">{run.gitSha ?? "—"}</dd>
        </div>
      </dl>

      {failures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-red-800">
            Failed scenarios ({failures.length})
          </h2>
          <ul className="space-y-3">
            {failures.map((row) => (
              <li
                key={row.scenarioId}
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm"
              >
                <p className="font-semibold text-red-900">{row.scenarioId}</p>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-red-800">
                  {row.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
                <pre className="mt-3 overflow-x-auto rounded bg-white/80 p-2 text-xs text-neutral-700">
                  {JSON.stringify(row.actual, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">All scenarios</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-2 font-medium">Scenario</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">Goal</th>
                <th className="px-4 py-2 font-medium">T0</th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((row) => (
                <tr key={row.scenarioId} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.scenarioId}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        row.passed
                          ? "text-green-700"
                          : "font-medium text-red-700"
                      }
                    >
                      {row.passed ? "pass" : "fail"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {row.actual.topGoal ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {row.actual.usedT0 ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
