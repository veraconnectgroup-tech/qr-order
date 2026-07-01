import type { DeadLetterQueueRow } from "@/lib/outbox/dead-letter-queue";
import type { OutboxHandlerMetric } from "@/lib/outbox/types";
import { AdminDlqRetryButton } from "@/components/admin/admin-dlq-retry-button";

function formatDlqPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const envelope = payload as Record<string, unknown>;
  const outboxPayload =
    envelope.outboxPayload && typeof envelope.outboxPayload === "object"
      ? (envelope.outboxPayload as Record<string, unknown>)
      : envelope;
  const orderId =
    typeof outboxPayload.orderId === "string"
      ? outboxPayload.orderId
      : typeof envelope.aggregateId === "string"
        ? envelope.aggregateId
        : undefined;
  const orderNumber = outboxPayload.orderNumber;
  if (typeof orderId === "string" && orderNumber != null) {
    return `Order #${String(orderNumber)} · ${orderId.slice(0, 8)}…`;
  }
  if (typeof orderId === "string") return `${orderId.slice(0, 12)}…`;
  return JSON.stringify(outboxPayload).slice(0, 80);
}

function MetricCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {props.label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {props.value}
      </p>
      {props.hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function OutboxDlqPanel({
  rows,
  metrics,
}: {
  rows: DeadLetterQueueRow[];
  metrics: OutboxHandlerMetric[];
}) {
  const totalThroughput = metrics.reduce((sum, row) => sum + row.throughput, 0);
  const totalFailures = metrics.reduce(
    (sum, row) => sum + row.failed + row.deadLetter,
    0
  );
  const avgLatency =
    metrics.length > 0
      ? Math.round(
          metrics.reduce((sum, row) => sum + row.avgLatencyMs, 0) / metrics.length
        )
      : 0;
  const failureRate =
    totalThroughput + totalFailures > 0
      ? Math.round((totalFailures / (totalThroughput + totalFailures)) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Throughput (24h)"
          value={String(totalThroughput)}
          hint="Completed outbox handlers"
        />
        <MetricCard
          label="Failure rate"
          value={`${failureRate}%`}
          hint={`${totalFailures} failed or dead-lettered`}
        />
        <MetricCard
          label="Avg latency"
          value={`${avgLatency} ms`}
          hint="Per handler type (24h)"
        />
        <MetricCard
          label="Unresolved DLQ"
          value={String(rows.length)}
          hint="Manual retry available"
        />
      </div>

      {metrics.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Handler</th>
                <th className="px-4 py-3">Throughput</th>
                <th className="px-4 py-3">Failures</th>
                <th className="px-4 py-3">Failure rate</th>
                <th className="px-4 py-3">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((row) => (
                <tr key={row.eventType} className="border-b border-border">
                  <td className="px-4 py-3 font-mono text-xs">{row.eventType}</td>
                  <td className="px-4 py-3 tabular-nums">{row.throughput}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.failed + row.deadLetter}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.failureRate}%</td>
                  <td className="px-4 py-3 tabular-nums">{row.avgLatencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Failed at</th>
              <th className="px-4 py-3">Handler</th>
              <th className="px-4 py-3">Payload</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No dead-letter events — all handlers healthy.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.job_type}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {formatDlqPayload(row.payload)}
                  </td>
                  <td className="max-w-sm truncate px-4 py-3 text-amber-400">
                    {row.error_message ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.attempts}/{row.max_attempts}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AdminDlqRetryButton dlqId={row.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
