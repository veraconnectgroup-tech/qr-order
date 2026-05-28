import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, GitBranch, Target, Brain } from "lucide-react";
import { QrCard, QrCardTitle } from "@/components/design-system/qr-card";
import type { DenisSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import { cn } from "@/lib/utils";

function DebugSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: typeof Brain;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <QrCard className={cn("p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-[var(--qr-ember)]" />
        <QrCardTitle className="text-base">{title}</QrCardTitle>
      </div>
      {children}
    </QrCard>
  );
}

export function DenisDebugGraphView({
  sessionId,
  graph,
}: {
  sessionId: string;
  graph: DenisSessionDebugGraph;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/denis-debug"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          All sessions
        </Link>
        <span className="text-border">|</span>
        <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {sessionId}
        </code>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DebugSection icon={Brain} title="Beliefs">
          {graph.beliefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No folded beliefs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {graph.beliefs.map((row) => (
                <li key={row.key} className="border-b border-border pb-2 last:border-0">
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.key}
                  </div>
                  <div className="text-foreground">{row.value}</div>
                  <div className="text-xs text-muted-foreground/80">
                    {row.source} · conf {row.confidence} · seq {row.evidenceSeq}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DebugSection>

        <DebugSection icon={GitBranch} title="Flow">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Current node</dt>
              <dd className="font-mono font-medium text-foreground">
                {graph.flow.currentNodeId}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Previous</dt>
              <dd className="font-mono text-foreground/90">
                {graph.flow.previousNodeId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last signal</dt>
              <dd className="text-foreground/90">{graph.flow.lastSignal ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Transitions</dt>
              <dd className="text-foreground">{graph.flow.transitionCount}</dd>
            </div>
          </dl>
        </DebugSection>

        <DebugSection icon={Target} title="Goals">
          <p className="mb-2 text-xs text-muted-foreground">
            Top:{" "}
            <span className="font-mono font-medium text-foreground">
              {graph.topGoal ?? "—"}
            </span>
            {graph.meta.hasCartConflict ? (
              <span className="ml-2 text-amber-300">· cart conflict</span>
            ) : null}
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-foreground">
            {graph.goals.map((goal) => (
              <li key={`${goal.type}-${goal.priority}`}>
                <span className="font-mono">{goal.type}</span>
                <span className="text-muted-foreground"> (p{goal.priority})</span>
              </li>
            ))}
          </ol>
        </DebugSection>
      </div>

      <QrCard className="p-4">
        <QrCardTitle className="mb-3 text-base">Turns by trace</QrCardTitle>
        {graph.turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No traced turns — enable Denis timeline (rollout shadow or denis_only).
          </p>
        ) : (
          <div className="space-y-3">
            {graph.turns.map((turn) => (
              <div
                key={turn.traceId}
                className="rounded-md border border-border bg-muted/60 p-3 text-sm"
              >
                <code className="text-xs text-muted-foreground">{turn.traceId}</code>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Guest:</span>{" "}
                    {turn.guestText ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Intent:</span>{" "}
                    {turn.intent ?? "—"}
                    {turn.intentTier ? ` (${turn.intentTier})` : ""}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Goal:</span>{" "}
                    {turn.topGoal ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Flow:</span>{" "}
                    {turn.flowFrom ?? "?"} → {turn.flowTo ?? "?"}
                  </p>
                </div>
                {turn.narration ? (
                  <p className="mt-2 text-foreground">
                    <span className="text-muted-foreground">Narration:</span>{" "}
                    {turn.narration}
                    {turn.narrationTier ? (
                      <span className="text-muted-foreground/80">
                        {" "}
                        ({turn.narrationTier})
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {turn.skills.length > 0 ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Skills:{" "}
                    {turn.skills.map((s) => `${s.id}:${s.riskClass}`).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </QrCard>

      <QrCard className="p-4">
        <QrCardTitle className="mb-3 text-base">
          Timeline ({graph.meta.eventCount} events)
        </QrCardTitle>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Seq</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Trace</th>
                <th className="px-2 py-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {graph.timeline.map((row) => (
                <tr key={row.seq} className="border-t border-border">
                  <td className="px-2 py-2 font-mono text-foreground">{row.seq}</td>
                  <td className="px-2 py-2 text-foreground">{row.eventType}</td>
                  <td className="max-w-[8rem] truncate px-2 py-2 font-mono text-muted-foreground">
                    {row.traceId?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-muted-foreground">
                    {row.payloadPreview}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QrCard>
    </div>
  );
}
