import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FeatureFlagToggles } from "@/components/platform/feature-flag-toggles";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { Button } from "@/components/ui/button";
import { loadPlatformOrgDetail } from "@/lib/platform/platform-stats";
import { impersonateOrgAction } from "@/lib/platform/platform-actions";
import { formatPrice } from "@/lib/format";
import type { Json } from "@/types/database";

export default async function PlatformOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const detail = await loadPlatformOrgDetail(orgId);
  if (!detail) notFound();

  const { org, owner, locationCount, staffCount, orderCount, revenue, trial_status } =
    detail;
  const orgRow = org as {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    currency: string;
    stripe_onboarded: boolean;
    stripe_account_id: string | null;
    trial_ends_at: string | null;
    feature_flags: Json;
    created_at: string;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link
          href="/platform/orgs"
          className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="me-1 size-4" />
          Organizations
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">{orgRow.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {orgRow.slug} · {trial_status}
          {orgRow.trial_ends_at && (
            <> · trial until {new Date(orgRow.trial_ends_at).toLocaleDateString()}</>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard label="Locations" value={String(locationCount)} />
        <AnalyticsMetricCard label="Staff" value={String(staffCount)} />
        <AnalyticsMetricCard label="Paid orders" value={String(orderCount)} />
        <AnalyticsMetricCard
          label="Revenue"
          value={formatPrice(revenue, orgRow.currency)}
        />
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Stripe</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {orgRow.stripe_onboarded
            ? `Connected (${orgRow.stripe_account_id ?? "account linked"})`
            : "Not connected"}
        </p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Owner</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {owner?.name ?? "—"}
          {owner?.email && <> · {owner.email}</>}
        </p>
        <form action={impersonateOrgAction} className="mt-4">
          <input type="hidden" name="orgId" value={orgId} />
          <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
            Login as owner
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Feature flags</h2>
        <FeatureFlagToggles orgId={orgId} featureFlags={orgRow.feature_flags} />
      </section>
    </div>
  );
}
