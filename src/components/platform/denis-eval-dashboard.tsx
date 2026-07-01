import Link from "next/link";
import { PlatformBarChart } from "@/components/platform/platform-bar-chart";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import type { loadDenisEvalDashboard } from "@/lib/platform/denis-eval-dashboard";
import { cn } from "@/lib/utils";

export function DenisEvalDashboard({
  data,
}: {
  data: Awaited<ReturnType<typeof loadDenisEvalDashboard>>;
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <AnalyticsMetricCard
          label="Global pass rate"
          value={
            data.globalPassRate != null ? `${data.globalPassRate}%` : "—"
          }
          tone={data.latestRunOk === false ? "warning" : "default"}
        />
        <AnalyticsMetricCard label="Eval runs" value={String(data.runCount)} />
        <AnalyticsMetricCard
          label="Latest run"
          value={data.latestRunOk == null ? "—" : data.latestRunOk ? "pass" : "fail"}
          tone={data.latestRunOk === false ? "warning" : "default"}
        />
      </div>

      {data.qualitySeries.length > 0 && (
        <PlatformBarChart
          title="Global quality score trend"
          description="Golden kernel pass rate by day"
          data={data.qualitySeries}
          color="#f97316"
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Cross-org Denis performance
        </h2>
        <p className="text-sm text-muted-foreground">
          Ranked by composite quality score (experience + conversion, 30d window).
        </p>
        {data.crossOrgScores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No venue metrics yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Organization</th>
                  <th className="px-4 py-2 font-medium">Quality</th>
                  <th className="px-4 py-2 font-medium">Turns (24h)</th>
                  <th className="px-4 py-2 font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.crossOrgScores.map((row, index) => (
                  <tr key={row.orgId} className="border-b last:border-0">
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/platform/orgs/${row.orgId}`}
                        className="font-medium text-violet-700 hover:underline"
                      >
                        {row.orgName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.slug}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          row.qualityScore >= 80
                            ? "bg-emerald-100 text-emerald-800"
                            : row.qualityScore >= 60
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                        )}
                      >
                        {row.qualityScore}
                      </span>
                      {row.lowBalance && (
                        <span className="ms-2 text-xs text-amber-700">low credits</span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{row.turns24h}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {(row.conversionRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.edgeCases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Edge cases across venues
          </h2>
          <p className="text-sm text-muted-foreground">
            Recurring golden-eval failures from recent runs.
          </p>
          <ul className="space-y-2">
            {data.edgeCases.map((edge) => (
              <li
                key={edge.scenarioId}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium">{edge.scenarioId}</span>
                  <span className="text-xs text-muted-foreground">
                    {edge.failCount} failure{edge.failCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{edge.lastError}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
