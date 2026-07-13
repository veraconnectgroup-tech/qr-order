import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPendingAdapterReviews } from "@/lib/denis/integrations/review/adapter-review-workflow";

export default async function IntegrationReviewsPlatformPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const pending = await listPendingAdapterReviews(admin);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/platform"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Platform
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Integration Builder — pending reviews
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated POS/API adapters, sandbox-verified and awaiting human
          approval before they can be activated (ADR-052 §C steps 13–14).
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No adapter versions awaiting review.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Requested</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(({ request, version, provider }) => (
                <tr key={request.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-foreground">
                    <Link
                      href={`/platform/integrations/${request.id}`}
                      className="hover:text-violet-700 hover:underline"
                    >
                      {provider.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    v{version.version_number}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(request.requested_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-amber-700">
                      {version.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
