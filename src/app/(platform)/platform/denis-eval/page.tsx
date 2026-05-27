import Link from "next/link";
import { listRecentDenisEvalRuns } from "@/lib/platform/denis-eval-runs";

export default async function DenisEvalRunsPlatformPage() {
  const runs = await listRecentDenisEvalRuns(30);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href="/platform"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Platform
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          Denis eval runs
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Golden kernel regression history (M24). Record via{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">
            pnpm eval:denis:record
          </code>
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-neutral-500">No eval runs recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">Scenarios</th>
                <th className="px-4 py-2 font-medium">Git</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-neutral-800">
                    <Link
                      href={`/platform/denis-eval/${run.id}`}
                      className="hover:text-violet-700 hover:underline"
                    >
                      {new Date(run.createdAt).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{run.source}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        run.ok
                          ? "font-medium text-green-700"
                          : "font-medium text-red-700"
                      }
                    >
                      {run.ok ? "pass" : "fail"}
                    </span>
                    <span className="text-neutral-500">
                      {" "}
                      ({run.passed}/{run.scenarioCount})
                    </span>
                  </td>
                  <td className="px-4 py-2">{run.scenarioCount}</td>
                  <td className="max-w-[12rem] truncate px-4 py-2 font-mono text-xs text-neutral-500">
                    {run.gitSha ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
