import Link from "next/link";
import { DenisEvalDashboard } from "@/components/platform/denis-eval-dashboard";
import { listRecentDenisEvalRuns } from "@/lib/platform/denis-eval-runs";
import { loadDenisEvalDashboard } from "@/lib/platform/denis-eval-dashboard";

export default async function DenisEvalRunsPlatformPage() {
  const [runs, dashboard] = await Promise.all([
    listRecentDenisEvalRuns(30),
    loadDenisEvalDashboard(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link
          href="/platform"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Platform
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Denis eval dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-org quality scores, global eval trend, and golden kernel regression
          history.
        </p>
      </div>

      <DenisEvalDashboard data={dashboard} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Recent eval runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eval runs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-muted/30 text-muted-foreground">
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
                    <td className="px-4 py-2 text-foreground">
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
                      <span className="text-muted-foreground">
                        {" "}
                        ({run.passed}/{run.scenarioCount})
                      </span>
                    </td>
                    <td className="px-4 py-2">{run.scenarioCount}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2 font-mono text-xs text-muted-foreground">
                      {run.gitSha ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
