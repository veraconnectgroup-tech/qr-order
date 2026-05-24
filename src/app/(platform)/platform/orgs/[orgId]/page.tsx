import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FeatureFlagToggles } from "@/components/platform/feature-flag-toggles";
import { CopyableText } from "@/components/platform/copyable-text";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { Button } from "@/components/ui/button";
import { loadPlatformOrgDetail } from "@/lib/platform/platform-stats";
import { impersonateOrgAction } from "@/lib/platform/platform-actions";
import { formatPrice, fromCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";
import { PlatformPlanSelector } from "@/components/platform/platform-plan-selector";
import { DlqRetryButton } from "@/components/platform/dlq-retry-button";

function posStatusLabel(status: string) {
  if (status === "connected") return { label: "Aktiv", className: "text-emerald-600" };
  if (status === "error") return { label: "Fehler", className: "text-red-600" };
  return { label: "Inaktiv", className: "text-neutral-500" };
}

function printerTypeLabel(type: string) {
  if (type === "usb") return "USB";
  if (type === "lan") return "LAN";
  if (type === "cloud") return "Cloud";
  return type;
}

export default async function PlatformOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const detail = await loadPlatformOrgDetail(orgId);
  if (!detail) notFound();

  const {
    org,
    owner,
    locationCount,
    staffCount,
    orderCount,
    revenue,
    trial_status,
    posIntegrations,
    printers,
    pendingPrintJobs,
    failedJobs,
    plans,
    currentPlan,
  } = detail;

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
    fiskaly_tss_id: string | null;
    steuernummer: string | null;
    ust_id_nr: string | null;
    plan_id: string | null;
    subscription_status: string | null;
    stripe_subscription_id: string | null;
  };

  const tseActive = Boolean(orgRow.fiskaly_tss_id);

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
        <h2 className="text-lg font-semibold text-neutral-900">Subscription</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-neutral-500">Current plan</dt>
            <dd className="mt-1 text-neutral-800">
              {currentPlan?.name ?? orgRow.plan_id ?? "starter"}
              {currentPlan && (
                <span className="text-neutral-500">
                  {" "}
                  · {formatPrice(fromCents(currentPlan.price_cents), currentPlan.currency)}/mo
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-neutral-500">Subscription status</dt>
            <dd className="mt-1 capitalize text-neutral-800">
              {orgRow.subscription_status ?? "trialing"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-neutral-500">Trial end date</dt>
            <dd className="mt-1 text-neutral-800">
              {orgRow.trial_ends_at
                ? new Date(orgRow.trial_ends_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          {orgRow.stripe_subscription_id && (
            <div>
              <dt className="font-medium text-neutral-500">Stripe subscription</dt>
              <dd className="mt-1 font-mono text-xs text-neutral-600">
                {orgRow.stripe_subscription_id}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-neutral-500">Change plan</dt>
            <dd>
              <PlatformPlanSelector
                orgId={orgId}
                currentPlanId={orgRow.plan_id}
                plans={plans}
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Fiscal / TSE</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-neutral-500">TSE Status</dt>
            <dd className="mt-1">
              <span
                className={cn(
                  "font-medium",
                  tseActive ? "text-emerald-600" : "text-red-600"
                )}
              >
                {tseActive ? "Aktiv" : "Nicht eingerichtet"}
              </span>
            </dd>
          </div>
          {orgRow.fiskaly_tss_id && (
            <div>
              <dt className="font-medium text-neutral-500">TSS ID</dt>
              <dd>
                <CopyableText value={orgRow.fiskaly_tss_id} />
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-neutral-500">Steuernummer</dt>
            <dd className="mt-1 text-neutral-800">
              {orgRow.steuernummer?.trim() || "Nicht hinterlegt"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-neutral-500">USt-IdNr</dt>
            <dd className="mt-1 text-neutral-800">
              {orgRow.ust_id_nr?.trim() || "Nicht hinterlegt"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">POS-Integration</h2>
        {posIntegrations.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            Keine POS-Integration (Standalone-Modus)
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {posIntegrations.map((pos, index) => {
              const status = posStatusLabel(pos.status);
              return (
                <li
                  key={`${pos.provider}-${index}`}
                  className="rounded-md border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize text-neutral-900">
                      {pos.provider}
                    </span>
                    <span className={cn("font-medium", status.className)}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-neutral-500">
                    {pos.external_location_id ?? "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Drucker</h2>
        {printers.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">Keine Drucker konfiguriert</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-neutral-600">
              {pendingPrintJobs} ausstehende Druckaufträge
            </p>
            <ul className="mt-4 space-y-3">
              {printers.map((printer) => (
                <li
                  key={printer.id}
                  className="rounded-md border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">{printer.name}</span>
                    <span className="text-neutral-600">
                      {printerTypeLabel(printer.type)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {printer.auto_print ? "Auto-Druck aktiv" : "Manuell"} ·{" "}
                    {printer.pending_jobs} pending
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Failed jobs</h2>
        {failedJobs.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No unresolved failed jobs.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {failedJobs.map((job) => (
              <li
                key={job.id}
                className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900">{job.job_type}</p>
                    <p className="mt-1 text-xs text-neutral-600">
                      {new Date(job.created_at).toLocaleString()}
                    </p>
                    {job.error_message && (
                      <p className="mt-2 text-xs text-red-700">{job.error_message}</p>
                    )}
                  </div>
                  <DlqRetryButton dlqId={job.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
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
