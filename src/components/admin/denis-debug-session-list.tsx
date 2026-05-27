import Link from "next/link";
import { Activity } from "lucide-react";
import type { DenisDebugSessionRow } from "@/lib/admin/denis-debug";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DenisDebugSessionList({
  sessions,
}: {
  sessions: DenisDebugSessionRow[];
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No AI sessions for this location yet. Denis timeline events appear after
        guest chat with kernel rollout enabled.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Table</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Lang</th>
            <th className="px-4 py-3">Timeline</th>
            <th className="px-4 py-3 text-right">Debug</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className="border-t border-border">
              <td className="px-4 py-3 text-foreground/90">
                {formatWhen(session.createdAt)}
              </td>
              <td className="px-4 py-3 text-foreground">
                {session.tableName ?? session.tableId.slice(0, 8)}
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {session.status}
              </td>
              <td className="px-4 py-3 uppercase text-muted-foreground">
                {session.language}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Activity className="size-3.5" />
                  {session.timelineEventCount}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/denis-debug/${session.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  Open graph
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
