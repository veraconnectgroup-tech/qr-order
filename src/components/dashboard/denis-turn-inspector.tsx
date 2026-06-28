"use client";

import { useCallback, useEffect, useState } from "react";
import { parseApiErrorFromJson } from "@/lib/api-error-client";
import type { TurnTrace } from "@/lib/denis/runtime/turn-trace";

type TurnRecord = TurnTrace & {
  traceId: string;
  createdAt?: string;
};

type Props = {
  sessionId: string;
};

function PhaseBar({ phases }: { phases: TurnTrace["phases"] }) {
  const entries = [
    { label: "Context", ms: phases.context.durationMs },
    { label: "Perceive", ms: phases.perceive.durationMs },
    { label: "Act", ms: phases.act.durationMs },
    { label: "Narrate", ms: phases.narrate.durationMs },
  ];
  const total = Math.max(
    1,
    entries.reduce((sum, entry) => sum + entry.ms, 0)
  );

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div key={entry.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-dash-muted">{entry.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-dash-border">
            <div
              className="h-full rounded bg-ember-500/80"
              style={{ width: `${Math.max(4, (entry.ms / total) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums text-dash-muted">
            {entry.ms}ms
          </span>
        </div>
      ))}
    </div>
  );
}

function Expandable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-dash-border bg-dash-surface/40 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-dash-foreground">
        {title}
      </summary>
      <div className="mt-2 text-xs text-dash-muted">{children}</div>
    </details>
  );
}

export function DenisTurnInspector({ sessionId }: Props) {
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/denis-traces?sessionId=${encodeURIComponent(sessionId)}`
      );
      const json = await res.json();
      if (!res.ok) {
        const parsed = parseApiErrorFromJson(json, res.status);
        setError(parsed?.message ?? "Failed to load traces");
        setTurns([]);
        return;
      }
      setTurns(json.data?.turns ?? json.turns ?? []);
    } catch {
      setError("Network error loading traces");
      setTurns([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 rounded-xl border border-dash-border p-4">
        <div className="h-4 w-1/3 rounded bg-dash-border" />
        <div className="h-20 rounded bg-dash-border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (turns.length === 0) {
    return (
      <p className="text-sm text-dash-muted">
        No turn traces for this session yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <article
          key={turn.traceId}
          className="rounded-xl border border-dash-border bg-card p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-dash-surface px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-ember-400">
              {turn.phases.plan.tier}
            </span>
            <span className="text-xs text-dash-muted tabular-nums">
              {turn.totalDurationMs}ms · {turn.totalTokens} tok · $
              {(turn.estimatedCostUsd ?? 0).toFixed(4)}
            </span>
          </div>

          <div className="mb-3 rounded-lg bg-dash-surface/60 p-3">
            <p className="text-xs uppercase tracking-wide text-dash-muted">Guest</p>
            <p className="mt-1 text-sm text-dash-foreground">{turn.guestInput}</p>
          </div>

          <div className="mb-3 rounded-lg bg-ember-500/5 p-3">
            <p className="text-xs uppercase tracking-wide text-dash-muted">Denis</p>
            <p className="mt-1 text-sm text-dash-foreground">
              {turn.denisResponse ?? ""}
            </p>
          </div>

          <PhaseBar phases={turn.phases} />

          <div className="mt-3 space-y-2">
            <Expandable title="Plan">
              <p>Kind: {turn.phases.plan.planKind}</p>
              {turn.phases.plan.reflexReason ? (
                <p>Reflex: {turn.phases.plan.reflexReason}</p>
              ) : null}
            </Expandable>
            <Expandable title="Perceive">
              <p>LLM: {turn.phases.perceive.llmUsed ? "yes" : "no (T0/reflex)"}</p>
              {turn.phases.perceive.model ? (
                <p>Model: {turn.phases.perceive.model}</p>
              ) : null}
            </Expandable>
            <Expandable title="Act">
              <p>Cart actions: {turn.phases.act.cartActions}</p>
              <p>Submit: {turn.phases.act.submitTriggered ? "yes" : "no"}</p>
            </Expandable>
          </div>
        </article>
      ))}
    </div>
  );
}
