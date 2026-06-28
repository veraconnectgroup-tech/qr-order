import { createAdminClient } from "@/lib/supabase/admin";
import type { RevenueSeriesPoint } from "@/lib/analytics/admin-analytics";
import {
  parseDenisEvalRunDetailRow,
  parseDenisEvalRunRows,
} from "@/lib/supabase/parse-eval-rows";

export type OrgDenisScore = {
  orgId: string;
  orgName: string;
  slug: string;
  qualityScore: number;
  turns24h: number;
  conversionRate: number;
  experienceScore: number | null;
  lowBalance: boolean;
};

export function computeOrgQualityScore(input: {
  conversionRate: number;
  experienceScore: number | null;
  lowBalance: boolean;
}): number {
  const base =
    input.experienceScore != null
      ? input.experienceScore
      : Math.round(input.conversionRate * 100);
  const penalty = input.lowBalance ? 5 : 0;
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

export function rankOrgDenisScores(scores: OrgDenisScore[]): OrgDenisScore[] {
  return [...scores].sort((a, b) => b.qualityScore - a.qualityScore);
}

export type EvalQualityPoint = {
  label: string;
  passRate: number;
};

export function computeEvalQualityTrend(
  runs: Array<{ createdAt: string; passed: number; scenarioCount: number }>
): EvalQualityPoint[] {
  const byDay = new Map<string, { passed: number; total: number }>();

  for (const run of runs) {
    const day = run.createdAt.slice(0, 10);
    const cur = byDay.get(day) ?? { passed: 0, total: 0 };
    cur.passed += run.passed;
    cur.total += run.scenarioCount;
    byDay.set(day, cur);
  }

  const days = [...byDay.keys()].sort();
  return days.map((day) => {
    const row = byDay.get(day)!;
    const passRate = row.total > 0 ? Math.round((row.passed / row.total) * 1000) / 10 : 0;
    const date = new Date(`${day}T12:00:00`);
    return {
      label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      passRate,
    };
  });
}

export type EvalEdgeCase = {
  scenarioId: string;
  failCount: number;
  lastError: string;
};

export function collectEvalEdgeCases(
  runs: Array<{
    results: Array<{ scenarioId: string; passed: boolean; errors: string[] }>;
  }>,
  limit = 10
): EvalEdgeCase[] {
  const counts = new Map<string, { failCount: number; lastError: string }>();

  for (const run of runs) {
    for (const row of run.results) {
      if (row.passed) continue;
      const existing = counts.get(row.scenarioId) ?? { failCount: 0, lastError: "" };
      existing.failCount += 1;
      existing.lastError = row.errors[0] ?? "Unknown failure";
      counts.set(row.scenarioId, existing);
    }
  }

  return [...counts.entries()]
    .map(([scenarioId, meta]) => ({
      scenarioId,
      failCount: meta.failCount,
      lastError: meta.lastError,
    }))
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, limit);
}

export async function loadCrossOrgDenisScores(limit = 20): Promise<OrgDenisScore[]> {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: opsRows }, { data: analyticsRows }] = await Promise.all([
    admin.from("organizations").select("id, name, slug, feature_flags"),
    admin.from("org_ai_ops").select("org_id, turns_24h, low_balance, credit_balance"),
    admin
      .from("experience_analytics_daily")
      .select(
        "org_id, sessions_closed, converted_sessions, experience_score, metric_date"
      )
      .gte(
        "metric_date",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      ),
  ]);

  const opsByOrg = new Map(
    ((opsRows ?? []) as Array<{
      org_id: string;
      turns_24h: number;
      low_balance: boolean;
    }>).map((row) => [row.org_id, row])
  );

  const experienceByOrg = new Map<
    string,
    { sessions: number; converted: number; scoreSum: number; scoreCount: number }
  >();

  for (const row of analyticsRows ?? []) {
    const r = row as {
      org_id: string;
      sessions_closed: number;
      converted_sessions: number;
      experience_score: number | null;
    };
    const cur = experienceByOrg.get(r.org_id) ?? {
      sessions: 0,
      converted: 0,
      scoreSum: 0,
      scoreCount: 0,
    };
    cur.sessions += r.sessions_closed;
    cur.converted += r.converted_sessions;
    if (r.experience_score != null) {
      cur.scoreSum += r.experience_score;
      cur.scoreCount += 1;
    }
    experienceByOrg.set(r.org_id, cur);
  }

  const scores: OrgDenisScore[] = ((orgs ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
  }>).map((org) => {
    const ops = opsByOrg.get(org.id);
    const exp = experienceByOrg.get(org.id);
    const conversionRate =
      exp && exp.sessions > 0 ? exp.converted / exp.sessions : 0;
    const experienceScore =
      exp && exp.scoreCount > 0 ? Math.round(exp.scoreSum / exp.scoreCount) : null;

    return {
      orgId: org.id,
      orgName: org.name,
      slug: org.slug,
      turns24h: ops?.turns_24h ?? 0,
      conversionRate,
      experienceScore,
      lowBalance: ops?.low_balance ?? false,
      qualityScore: computeOrgQualityScore({
        conversionRate,
        experienceScore,
        lowBalance: ops?.low_balance ?? false,
      }),
    };
  });

  return rankOrgDenisScores(scores).slice(0, limit);
}

export async function loadDenisEvalDashboard() {
  const admin = createAdminClient();

  const [{ data: runRows }, crossOrgScores] = await Promise.all([
    admin
      .from("denis_eval_runs" as never)
      .select(
        "id, source, created_at, passed, scenario_count, failed, ok, results"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    loadCrossOrgDenisScores(10),
  ]);

  const parsed = parseDenisEvalRunRows(runRows ?? []);
  const detailRuns = (runRows ?? []).map((row) => parseDenisEvalRunDetailRow(row));

  const qualityTrend = computeEvalQualityTrend(
    parsed.map((row) => ({
      createdAt: row.created_at,
      passed: row.passed,
      scenarioCount: row.scenario_count,
    }))
  );

  const edgeCases = collectEvalEdgeCases(
    detailRuns.map((row) => ({
      results: Array.isArray(row.results) ? row.results : [],
    }))
  );

  const latestRun = parsed[0];
  const globalPassRate =
    latestRun && latestRun.scenario_count > 0
      ? Math.round((latestRun.passed / latestRun.scenario_count) * 1000) / 10
      : null;

  const qualitySeries: RevenueSeriesPoint[] = qualityTrend.map((point) => ({
    label: point.label,
    revenue: point.passRate,
  }));

  return {
    crossOrgScores,
    qualityTrend,
    qualitySeries,
    edgeCases,
    globalPassRate,
    latestRunOk: latestRun?.ok ?? null,
    runCount: parsed.length,
  };
}
