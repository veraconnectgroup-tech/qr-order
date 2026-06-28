"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { QrCard, QrCardTitle } from "@/components/design-system/qr-card";
import type {
  DenisInsightsAggregate,
  UnknownIntentEdgeCase,
} from "@/lib/admin/denis-insights-aggregate";
import { cn } from "@/lib/utils";

export function DenisInsightsIntelligencePanel({
  aggregate,
}: {
  aggregate: DenisInsightsAggregate;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <IntentBreakdownCard intents={aggregate.intentBreakdown} />
        <ConversationQualityCard
          avgScore={aggregate.avgQualityScore}
          weekly={aggregate.weeklyQuality}
        />
        <ProblemsCard problems={aggregate.problems} />
      </div>

      <SuggestionsCard suggestions={aggregate.suggestions} />

      <EdgeCasesLog cases={aggregate.edgeCases} />
    </div>
  );
}

function IntentBreakdownCard({
  intents,
}: {
  intents: DenisInsightsAggregate["intentBreakdown"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Guest intents</QrCardTitle>
      {!intents.length ? (
        <p className="text-sm text-muted-foreground">No intent data yet.</p>
      ) : (
        <ul className="space-y-2">
          {intents.map((row) => (
            <li key={row.intent} className="flex items-center justify-between text-sm">
              <span>{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.percent}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}

function ConversationQualityCard({
  avgScore,
  weekly,
}: {
  avgScore: number;
  weekly: DenisInsightsAggregate["weeklyQuality"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Conversation quality</QrCardTitle>
      <p className="text-3xl font-bold tabular-nums text-[var(--qr-ember)]">
        {avgScore}
        <span className="text-base font-normal text-muted-foreground"> / 100</span>
      </p>
      {weekly.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {weekly.map((row) => (
            <li key={row.weekLabel} className="flex justify-between gap-2">
              <span>Week {row.weekLabel}</span>
              <span className="tabular-nums">
                {row.score} · {row.sessionCount} sessions
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </QrCard>
  );
}

function ProblemsCard({
  problems,
}: {
  problems: DenisInsightsAggregate["problems"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Problems detected</QrCardTitle>
      {!problems.length ? (
        <p className="text-sm text-muted-foreground">No issues in this period.</p>
      ) : (
        <ul className="space-y-2">
          {problems.map((problem) => (
            <li
              key={problem.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                problem.severity === "critical"
                  ? "border-red-500/30 bg-red-500/5"
                  : problem.severity === "warning"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border"
              )}
            >
              {problem.message}
              {problem.sampleGuestText ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  e.g. &quot;{problem.sampleGuestText}&quot;
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}

function SuggestionsCard({
  suggestions,
}: {
  suggestions: DenisInsightsAggregate["suggestions"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Improvement suggestions</QrCardTitle>
      <ul className="space-y-2">
        {suggestions.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-border/60 px-3 py-2 text-sm"
          >
            <p className="font-medium text-foreground">{row.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.action}</p>
          </li>
        ))}
      </ul>
    </QrCard>
  );
}

function EdgeCasesLog({ cases }: { cases: UnknownIntentEdgeCase[] }) {
  const [pending, startTransition] = useTransition();
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  function promote(edgeCase: UnknownIntentEdgeCase) {
    startTransition(async () => {
      const response = await fetch("/api/admin/denis-insights/edge-cases/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edgeCase),
      });
      const body = (await response.json()) as { error?: string; scenarioId?: string };
      if (!response.ok) {
        toast.error(body.error ?? "Failed to promote edge case");
        return;
      }
      setPromoted((current) => new Set(current).add(edgeCase.id));
      toast.success(`Added to eval fixture (${body.scenarioId})`);
    });
  }

  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Edge cases log</QrCardTitle>
      <p className="mb-3 text-xs text-muted-foreground">
        Unknown intents auto-collected from live sessions — review and add to eval
        fixtures.
      </p>
      {!cases.length ? (
        <p className="text-sm text-muted-foreground">No unknown intents captured.</p>
      ) : (
        <ul className="space-y-2">
          {cases.slice(0, 12).map((edgeCase) => (
            <li
              key={edgeCase.id}
              className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  &quot;{edgeCase.guestText}&quot;
                </p>
                {edgeCase.denisResponse ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Denis: {edgeCase.denisResponse}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pending || promoted.has(edgeCase.id)}
                onClick={() => promote(edgeCase)}
                className="shrink-0 rounded-lg border border-[var(--qr-ember)] px-3 py-1.5 text-xs font-medium text-[var(--qr-ember)] transition hover:bg-[var(--qr-ember)]/10 disabled:opacity-50"
              >
                {promoted.has(edgeCase.id) ? "In eval" : "Add to eval"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}
