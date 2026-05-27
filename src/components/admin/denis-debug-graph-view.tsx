import Link from "next/link";
import { ArrowLeft, GitBranch, Target, Brain } from "lucide-react";
import type { DenisSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";

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
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="size-4" />
          All sessions
        </Link>
        <span className="text-neutral-300">|</span>
        <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {sessionId}
        </code>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="size-4 text-blue-600" />
            <h3 className="font-semibold text-neutral-900">Beliefs</h3>
          </div>
          {graph.beliefs.length === 0 ? (
            <p className="text-sm text-neutral-500">No folded beliefs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {graph.beliefs.map((row) => (
                <li key={row.key} className="border-b border-neutral-50 pb-2">
                  <div className="font-mono text-xs text-neutral-500">
                    {row.key}
                  </div>
                  <div className="text-neutral-800">{row.value}</div>
                  <div className="text-xs text-neutral-400">
                    {row.source} · conf {row.confidence} · seq{" "}
                    {row.evidenceSeq}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="size-4 text-blue-600" />
            <h3 className="font-semibold text-neutral-900">Flow</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-neutral-500">Current node</dt>
              <dd className="font-mono font-medium text-neutral-900">
                {graph.flow.currentNodeId}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Previous</dt>
              <dd className="font-mono text-neutral-700">
                {graph.flow.previousNodeId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Last signal</dt>
              <dd className="text-neutral-700">
                {graph.flow.lastSignal ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Transitions</dt>
              <dd>{graph.flow.transitionCount}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="size-4 text-blue-600" />
            <h3 className="font-semibold text-neutral-900">Goals</h3>
          </div>
          <p className="mb-2 text-xs text-neutral-500">
            Top:{" "}
            <span className="font-mono font-medium text-neutral-800">
              {graph.topGoal ?? "—"}
            </span>
            {graph.meta.hasCartConflict ? (
              <span className="ml-2 text-amber-700">· cart conflict</span>
            ) : null}
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-neutral-800">
            {graph.goals.map((goal) => (
              <li key={`${goal.type}-${goal.priority}`}>
                <span className="font-mono">{goal.type}</span>
                <span className="text-neutral-400"> (p{goal.priority})</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-neutral-900">Turns by trace</h3>
        {graph.turns.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No traced turns — enable Denis timeline (rollout shadow or denis_only).
          </p>
        ) : (
          <div className="space-y-3">
            {graph.turns.map((turn) => (
              <div
                key={turn.traceId}
                className="rounded-md border border-neutral-100 bg-neutral-50/80 p-3 text-sm"
              >
                <code className="text-xs text-neutral-500">{turn.traceId}</code>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <p>
                    <span className="text-neutral-500">Guest:</span>{" "}
                    {turn.guestText ?? "—"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Intent:</span>{" "}
                    {turn.intent ?? "—"}
                    {turn.intentTier ? ` (${turn.intentTier})` : ""}
                  </p>
                  <p>
                    <span className="text-neutral-500">Goal:</span>{" "}
                    {turn.topGoal ?? "—"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Flow:</span>{" "}
                    {turn.flowFrom ?? "?"} → {turn.flowTo ?? "?"}
                  </p>
                </div>
                {turn.narration ? (
                  <p className="mt-2 text-neutral-800">
                    <span className="text-neutral-500">Narration:</span>{" "}
                    {turn.narration}
                    {turn.narrationTier ? (
                      <span className="text-neutral-400">
                        {" "}
                        ({turn.narrationTier})
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {turn.skills.length > 0 ? (
                  <p className="mt-1 font-mono text-xs text-neutral-600">
                    Skills:{" "}
                    {turn.skills.map((s) => `${s.id}:${s.riskClass}`).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-neutral-900">
          Timeline ({graph.meta.eventCount} events)
        </h3>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-neutral-500">
              <tr>
                <th className="px-2 py-2">Seq</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Trace</th>
                <th className="px-2 py-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {graph.timeline.map((row) => (
                <tr key={row.seq} className="border-t border-neutral-100">
                  <td className="px-2 py-2 font-mono">{row.seq}</td>
                  <td className="px-2 py-2">{row.eventType}</td>
                  <td className="max-w-[8rem] truncate px-2 py-2 font-mono text-neutral-500">
                    {row.traceId?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-neutral-600">
                    {row.payloadPreview}
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
