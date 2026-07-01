"use client";

import { useState, useTransition } from "react";
import { exportDenisAuditTrailCsv } from "@/lib/admin/denis-audit-trail-actions";
import type { DenisAuditTrailSnapshot } from "@/lib/admin/load-denis-audit-trail";

export function DenisAuditTrailPanel({
  snapshot,
}: {
  snapshot: DenisAuditTrailSnapshot;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportDenisAuditTrailCsv({ periodDays: 30 });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <section className="rounded-xl border border-dash-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-dash-text">
            Denis audit trail
          </h2>
          <p className="mt-1 text-xs text-dash-text-muted">
            Compliance log — guest input hashed, allergy events retained 365 days.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={pending}
          className="min-h-10 rounded-lg border border-dash-border bg-dash-surface px-4 text-sm font-medium text-dash-text transition hover:border-[var(--qr-ember)] disabled:opacity-60"
        >
          {pending ? "Exporting…" : "Export audit trail CSV"}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-dash-bg/60 p-3">
          <dt className="text-xs text-dash-text-muted">Turns ({snapshot.periodDays}d)</dt>
          <dd className="text-lg font-semibold text-dash-text">{snapshot.turnCount}</dd>
        </div>
        <div className="rounded-lg bg-dash-bg/60 p-3">
          <dt className="text-xs text-dash-text-muted">Allergy guards</dt>
          <dd className="text-lg font-semibold text-dash-text">
            {snapshot.allergyEventCount}
          </dd>
        </div>
        <div className="rounded-lg bg-dash-bg/60 p-3">
          <dt className="text-xs text-dash-text-muted">Orders submitted</dt>
          <dd className="text-lg font-semibold text-dash-text">
            {snapshot.orderSubmitCount}
          </dd>
        </div>
      </dl>

      {snapshot.allergyAuditBlock ? (
        <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-dash-bg/80 p-3 text-xs text-dash-text-muted whitespace-pre-wrap">
          {snapshot.allergyAuditBlock}
        </pre>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      ) : null}
    </section>
  );
}
