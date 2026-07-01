"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DenisDebugGraphView } from "@/components/admin/denis-debug-graph-view";
import { QrCard, QrCardTitle } from "@/components/design-system/qr-card";
import type { DenisSessionReplay } from "@/lib/admin/denis-session-replay";
import type { DenisSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import { cn } from "@/lib/utils";

type Tab = "timeline" | "why" | "mental" | "proactive" | "graph";

export function DenisDebugReplayView({
  sessionId,
  replay,
}: {
  sessionId: string;
  replay: DenisSessionReplay & { graph: DenisSessionDebugGraph };
}) {
  const [tab, setTab] = useState<Tab>("timeline");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "timeline", label: "Timeline replay" },
    { id: "why", label: "Why Denis said X" },
    { id: "mental", label: "Mental model" },
    { id: "proactive", label: "Proactive" },
    { id: "graph", label: "Beliefs & flow" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/denis-debug"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          All sessions
        </Link>
        <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {sessionId}
        </code>
        {replay.qualityScore ? (
          <span className="rounded-full bg-[var(--qr-ember)]/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--qr-ember)]">
            Quality {replay.qualityScore.overall}/100
          </span>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              tab === entry.id
                ? "border-[var(--qr-ember)] bg-[var(--qr-ember)]/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "timeline" ? <TimelineReplay events={replay.timeline} /> : null}
      {tab === "why" ? <WhyDenisSaid turns={replay.turnExplanations} /> : null}
      {tab === "mental" ? (
        <MentalModelEvolution snapshots={replay.mentalModelEvolution} />
      ) : null}
      {tab === "proactive" ? (
        <ProactiveDecisions rows={replay.proactiveDecisions} />
      ) : null}
      {tab === "graph" ? (
        <DenisDebugGraphView sessionId={sessionId} graph={replay.graph} />
      ) : null}
    </div>
  );
}

function TimelineReplay({
  events,
}: {
  events: DenisSessionReplay["timeline"];
}) {
  const categoryColor: Record<string, string> = {
    signal: "text-sky-500",
    view: "text-violet-500",
    act: "text-[var(--qr-ember)]",
    other: "text-muted-foreground",
  };

  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">
        Timeline replay ({events.length} events)
      </QrCardTitle>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-2 py-2">Seq</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Trace</th>
              <th className="px-2 py-2">Payload</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.seq} className="border-t border-border align-top">
                <td className="px-2 py-2 font-mono">{event.seq}</td>
                <td
                  className={cn(
                    "px-2 py-2 font-medium capitalize",
                    categoryColor[event.category]
                  )}
                >
                  {event.category}
                </td>
                <td className="px-2 py-2">{event.eventType}</td>
                <td className="max-w-[6rem] truncate px-2 py-2 font-mono text-muted-foreground">
                  {event.traceId?.slice(0, 8) ?? "—"}
                </td>
                <td className="max-w-md px-2 py-2 font-mono text-muted-foreground">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(event.payload, null, 0).slice(0, 400)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </QrCard>
  );
}

function WhyDenisSaid({
  turns,
}: {
  turns: DenisSessionReplay["turnExplanations"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Why Denis said X</QrCardTitle>
      {!turns.length ? (
        <p className="text-sm text-muted-foreground">No traced turns in this session.</p>
      ) : (
        <div className="space-y-3">
          {turns.map((turn) => (
            <article
              key={turn.traceId}
              className="rounded-lg border border-border bg-muted/40 p-3 text-sm"
            >
              <code className="text-xs text-muted-foreground">{turn.traceId}</code>
              <p className="mt-2">
                <span className="text-muted-foreground">Guest:</span>{" "}
                {turn.guestText ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Intent:</span>{" "}
                {turn.intent ?? "—"}
                {turn.intentTier ? ` (${turn.intentTier})` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Plan:</span>{" "}
                {turn.planKind ?? "—"}
                {turn.planReason ? ` — ${turn.planReason}` : ""}
              </p>
              {turn.situationContext ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Situation context
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                    {turn.situationContext}
                  </pre>
                </details>
              ) : null}
              {turn.llmPromptHint ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  LLM: {turn.llmPromptHint}
                </p>
              ) : null}
              <p className="mt-2 font-medium text-foreground">
                Response: {turn.response ?? turn.narration ?? "—"}
              </p>
              {turn.durationMs != null ? (
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {turn.durationMs}ms
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </QrCard>
  );
}

function MentalModelEvolution({
  snapshots,
}: {
  snapshots: DenisSessionReplay["mentalModelEvolution"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Mental model evolution</QrCardTitle>
      {!snapshots.length ? (
        <p className="text-sm text-muted-foreground">
          No mental model snapshots recorded.
        </p>
      ) : (
        <ul className="space-y-2">
          {snapshots.map((row) => (
            <li
              key={row.seq}
              className="rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <p className="text-xs text-muted-foreground">Seq {row.seq}</p>
              <p>
                Intent {row.intent ?? "—"} · Pace {row.pace ?? "—"} ·
                Receptiveness {row.receptiveness ?? "—"}
              </p>
              {row.frustration ? (
                <p className="text-amber-600">Frustration: {row.frustration}</p>
              ) : null}
              {row.changes.length > 0 ? (
                <ul className="mt-1 text-xs text-muted-foreground">
                  {row.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}

function ProactiveDecisions({
  rows,
}: {
  rows: DenisSessionReplay["proactiveDecisions"];
}) {
  return (
    <QrCard className="p-4">
      <QrCardTitle className="mb-3 text-base">Proactive decisions</QrCardTitle>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No proactive activity.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={`${row.seq}-${row.candidateKind}`}
              className="rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium capitalize">
                  {row.candidateKind.replace(/_/g, " ")}
                </span>
                {row.emitted ? (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                    Emitted
                  </span>
                ) : row.ranked ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Ranked / skipped
                  </span>
                ) : null}
              </div>
              {row.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
              ) : null}
              {row.message ? (
                <p className="mt-1 text-foreground">{row.message}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}
