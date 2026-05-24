import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { loadAuditLog } from "@/lib/audit/query";
import { AuditLogFilters } from "@/components/admin/audit-log-filters";
import { Button } from "@/components/ui/button";

function formatDetails(row: {
  old_value: unknown;
  new_value: unknown;
  entity_type: string;
}): string {
  const oldVal = row.old_value as Record<string, unknown> | null;
  const newVal = row.new_value as Record<string, unknown> | null;

  if (
    row.entity_type === "product" &&
    oldVal?.price != null &&
    newVal?.price != null
  ) {
    return `Price ${oldVal.price} → ${newVal.price}`;
  }

  if (newVal && Object.keys(newVal).length <= 4) {
    return JSON.stringify(newVal);
  }
  if (oldVal && Object.keys(oldVal).length <= 4) {
    return JSON.stringify(oldVal);
  }

  return "—";
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const staff = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const dateFrom = params.from
    ? new Date(`${params.from}T00:00:00.000Z`).toISOString()
    : undefined;
  const dateTo = params.to
    ? new Date(`${params.to}T23:59:59.999Z`).toISOString()
    : undefined;

  const result = await loadAuditLog(staff.org_id, {
    action: params.action,
    dateFrom,
    dateTo,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Audit log</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Who changed what and when — for compliance and troubleshooting.
        </p>
      </div>

      <Suspense fallback={null}>
        <AuditLogFilters />
      </Suspense>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No audit entries found.
                </td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3 tabular-nums text-neutral-600">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{row.userLabel}</td>
                  <td className="px-4 py-3 font-medium">{row.action}</td>
                  <td className="px-4 py-3">
                    {row.entity_type}
                    {row.entity_id ? (
                      <span className="block text-xs text-neutral-400">
                        {row.entity_id}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-neutral-600">
                    {formatDetails(row)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>
          Page {result.page} of {totalPages} · {result.total} entries
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/admin/audit-log?${new URLSearchParams({
                  ...(params.action ? { action: params.action } : {}),
                  ...(params.from ? { from: params.from } : {}),
                  ...(params.to ? { to: params.to } : {}),
                  page: String(page - 1),
                }).toString()}`}
              >
                Previous
              </Link>
            </Button>
          ) : null}
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/admin/audit-log?${new URLSearchParams({
                  ...(params.action ? { action: params.action } : {}),
                  ...(params.from ? { from: params.from } : {}),
                  ...(params.to ? { to: params.to } : {}),
                  page: String(page + 1),
                }).toString()}`}
              >
                Next
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
