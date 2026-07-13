import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdapterReviewDetail } from "@/lib/denis/integrations/review/adapter-review-workflow";
import { AdapterReviewActions } from "@/components/platform/adapter-review-actions";

export default async function IntegrationReviewDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await requirePlatformAdmin();
  const { requestId } = await params;
  const admin = createAdminClient();
  const detail = await loadAdapterReviewDetail(admin, requestId);

  if (!detail) notFound();

  const { request, version, provider, capabilities } = detail;
  const supportedCapabilities = capabilities.filter(
    (c) => c.status === "supported" || c.status === "supported_with_limitations"
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/platform/integrations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Pending reviews
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {provider.name} — v{version.version_number}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generated {new Date(version.generated_at).toLocaleString()} by{" "}
          {version.generated_by === "ai" ? "Denis (AI draft)" : "human patch"}.
          Currently: <span className="font-medium">{version.status}</span>.
        </p>
      </div>

      {request.decision !== "pending" ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          Already reviewed: <span className="font-medium">{request.decision}</span>
          {request.review_notes ? ` — "${request.review_notes}"` : ""}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Capabilities to be generated ({supportedCapabilities.length})
        </h2>
        {supportedCapabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No supported capabilities recorded for this provider.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Capability</th>
                  <th className="px-4 py-2 font-medium">Side effect</th>
                  <th className="px-4 py-2 font-medium">Endpoint</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {supportedCapabilities.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-2 text-foreground">{c.capability}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          c.side_effect_level === "financial" ||
                          c.side_effect_level === "destructive"
                            ? "font-medium text-red-700"
                            : c.side_effect_level === "mutating"
                              ? "font-medium text-amber-700"
                              : "text-muted-foreground"
                        }
                      >
                        {c.side_effect_level}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {c.endpoint ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-2 text-xs text-muted-foreground">
                      {c.quoted_span ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Generated adapter source
        </h2>
        <pre className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs">
          <code>{version.generated_code}</code>
        </pre>
      </section>

      {request.decision === "pending" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Decision</h2>
          <p className="text-sm text-muted-foreground">
            Approving activates this version as the adapter&apos;s current
            version (not yet connected to any location — that still goes
            through the existing pos_integrations connect flow). Rejecting
            requires a reason.
          </p>
          <AdapterReviewActions approvalRequestId={request.id} />
        </section>
      ) : null}
    </div>
  );
}
