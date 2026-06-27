import { Suspense } from "react";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import { AiConciergeSettings } from "@/components/admin/ai-concierge-settings";
import { DenisRolloutPanel } from "@/components/admin/denis-rollout-panel";
import { DenisQualityContractStrip } from "@/components/admin/denis-quality-contract-strip";
import { DenisManifestPromotePanel } from "@/components/admin/denis-manifest-promote-panel";
import { DenisSystemStatusPanel } from "@/components/admin/denis-system-status-panel";
import { loadDenisQualityContractStrip } from "@/lib/admin/denis-quality-contract";
import { loadDenisManifestAdminState } from "@/lib/admin/denis-manifest-actions";
import { loadDenisSystemStatus } from "@/lib/admin/denis-system-status";
import { listDenisDebugSessions } from "@/lib/admin/denis-debug";
import { loadDenisRolloutAdminState } from "@/lib/admin/denis-rollout-actions";
import { AiPlaybookPanel } from "@/components/admin/ai-playbook-panel";
import { LocationSettings } from "@/components/admin/location-settings";
import { StripeConnectButton } from "@/components/admin/stripe-connect-button";
import { TerminalReadersPanel } from "@/components/admin/terminal-readers-panel";
import { TseSettingsPanel } from "@/components/admin/tse-settings-panel";
import { PrinterSettingsPanel } from "@/components/admin/printer-settings-panel";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { OperatorApiKeysPanel } from "@/components/admin/operator-api-keys-panel";
import { OperatorConfigProposalsPanel } from "@/components/admin/operator-config-proposals-panel";
import { DenisConfigVersioningPanel } from "@/components/admin/denis-config-versioning-panel";
import { WebhooksPanel } from "@/components/admin/webhooks-panel";
import { listPendingOperatorProposals } from "@/lib/operator/config-proposals";
import { loadOperatorProposalPreviews } from "@/lib/admin/load-operator-proposal-previews";
import { loadConfigChangeHistory } from "@/lib/admin/load-config-change-history";
import { getConfigShadow } from "@/lib/denis/config/config-shadow";
import type { AiCreditPackage } from "@/types";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

export default async function AdminSettingsPage() {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const locationId = await getStaffLocationId(staff);

  const [{ data: org }, { data: location }, { data: credits }, { data: aiOps }, { data: packages }, { data: apiKeys }, { data: operatorApiKeys }, { data: webhooks }, { data: aiExamples }] =
    await Promise.all([
    admin
      .from("organizations")
      .select(
        "stripe_account_id, stripe_onboarded, name, email, currency, default_tax_percent, fiskaly_tss_id, fiskaly_client_id, steuernummer, ust_id_nr"
      )
      .eq("id", staff.org_id)
      .single(),
    locationId
      ? admin
          .from("locations")
          .select(
            "name, menu_locale, default_locale, google_review_url, ordering_enabled, require_first_table_approval, ai_concierge_enabled, ai_playbook"
          )
          .eq("id", locationId)
          .single()
      : Promise.resolve({ data: null }),
    admin
      .from("ai_credits")
      .select("balance, lifetime_used")
      .eq("org_id", staff.org_id)
      .maybeSingle(),
    admin
      .from("org_ai_ops")
      .select(
        "turns_24h, timeline_events_24h, low_balance, refreshed_at"
      )
      .eq("org_id", staff.org_id)
      .maybeSingle(),
    admin
      .from("ai_credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, created_at, revoked_at")
      .eq("org_id", staff.org_id)
      .order("created_at", { ascending: false }),
    admin
      .from("operator_api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, created_at, revoked_at")
      .eq("org_id", staff.org_id)
      .order("created_at", { ascending: false }),
    admin
      .from("webhook_configs")
      .select("id, url, events, is_active, failure_count, created_at")
      .eq("org_id", staff.org_id)
      .order("created_at", { ascending: false }),
    locationId
      ? admin
          .from("ai_examples")
          .select(
            "id, category, user_message, assistant_message, sort_order, is_active"
          )
          .eq("org_id", staff.org_id)
          .eq("location_id", locationId)
          .order("sort_order")
          .order("created_at")
      : Promise.resolve({ data: null }),
  ]);

  const pendingOperatorProposals = await listPendingOperatorProposals(
    admin,
    staff.org_id
  );

  const operatorProposalPreviews = pendingOperatorProposals.length
    ? await loadOperatorProposalPreviews(admin, pendingOperatorProposals)
    : [];

  const orgRow = org as {
    stripe_account_id: string | null;
    stripe_onboarded: boolean;
    name: string;
    email: string | null;
    currency: string;
    default_tax_percent: number;
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
    steuernummer: string | null;
    ust_id_nr: string | null;
  } | null;

  const locationRow = location as {
    name: string;
    menu_locale: string | null;
    default_locale: string | null;
    google_review_url: string | null;
    ordering_enabled: boolean;
    require_first_table_approval: boolean;
    ai_concierge_enabled: boolean;
    ai_playbook: string | null;
  } | null;

  const configChangeHistory =
    locationId && locationRow?.ai_concierge_enabled
      ? await loadConfigChangeHistory(admin, {
          orgId: staff.org_id,
          locationId,
          limit: 12,
        })
      : [];

  const configShadow =
    locationId && locationRow?.ai_concierge_enabled
      ? await getConfigShadow(locationId)
      : null;

  const creditsRow = credits as {
    balance: number;
    lifetime_used: number;
  } | null;

  const aiOpsRow = aiOps as {
    turns_24h: number;
    timeline_events_24h: number;
    low_balance: boolean;
    refreshed_at: string;
  } | null;

  const creditPackages = (packages ?? []) as AiCreditPackage[];

  const menuLocale = parseMenuLocaleFromDb(
    locationRow?.menu_locale,
    locationRow?.default_locale
  );

  const denisRolloutState =
    locationId && locationRow?.ai_concierge_enabled
      ? await loadDenisRolloutAdminState()
      : null;
  const denisRollout =
    denisRolloutState && !("error" in denisRolloutState)
      ? denisRolloutState
      : null;

  const qualityContractStrip =
    locationId && locationRow?.ai_concierge_enabled
      ? await loadDenisQualityContractStrip(locationId)
      : null;

  const manifestAdminState =
    locationId && locationRow?.ai_concierge_enabled
      ? await loadDenisManifestAdminState()
      : null;
  const manifestSessions =
    locationId && locationRow?.ai_concierge_enabled
      ? (await listDenisDebugSessions(admin, locationId)).filter(
          (row) => row.timelineEventCount > 0
        )
      : [];

  const systemStatus =
    locationId && locationRow?.ai_concierge_enabled
      ? await loadDenisSystemStatus()
      : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Settings</h1>

      <div className="space-y-6">
        <QrCard className="max-w-lg">
          <QrCardTitle>Organization</QrCardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{orgRow?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{orgRow?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="text-foreground">{orgRow?.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">VAT</dt>
              <dd className="text-foreground">{orgRow?.default_tax_percent}%</dd>
            </div>
          </dl>
        </QrCard>

        {locationRow && (
          <>
            <LocationSettings
              locationName={locationRow.name}
              menuLocale={menuLocale}
              googleReviewUrl={locationRow.google_review_url}
              orderingEnabled={locationRow.ordering_enabled}
              requireFirstTableApproval={
                locationRow.require_first_table_approval ?? true
              }
              aiConciergeEnabled={locationRow.ai_concierge_enabled}
              canEdit
            />

            <Suspense fallback={null}>
              <AiConciergeSettings
                locationName={locationRow.name}
                creditsBalance={creditsRow?.balance ?? 0}
                creditsLifetimeUsed={creditsRow?.lifetime_used ?? 0}
                aiOps={
                  aiOpsRow
                    ? {
                        turns24h: aiOpsRow.turns_24h,
                        timelineEvents24h: aiOpsRow.timeline_events_24h,
                        lowBalance: aiOpsRow.low_balance,
                        refreshedAt: aiOpsRow.refreshed_at,
                      }
                    : null
                }
                packages={creditPackages}
                currency={orgRow?.currency ?? "EUR"}
                canEdit
              />
            </Suspense>

            {locationRow.ai_concierge_enabled &&
              systemStatus &&
              !("error" in systemStatus) && (
                <DenisSystemStatusPanel status={systemStatus} />
              )}

            {locationRow.ai_concierge_enabled && denisRollout && (
              <DenisRolloutPanel initial={denisRollout} />
            )}

            {locationRow.ai_concierge_enabled && qualityContractStrip && (
              <DenisQualityContractStrip data={qualityContractStrip} />
            )}

            {locationRow.ai_concierge_enabled &&
              manifestAdminState &&
              !("error" in manifestAdminState) && (
                <DenisManifestPromotePanel
                  initial={manifestAdminState}
                  sessions={manifestSessions}
                />
              )}

            {locationRow.ai_concierge_enabled && (
              <AiPlaybookPanel
                playbook={locationRow.ai_playbook}
                examples={(aiExamples ?? []) as never}
                canEdit
              />
            )}

            {locationRow.ai_concierge_enabled && (
              <DenisConfigVersioningPanel
                history={configChangeHistory}
                shadow={configShadow}
                canEdit
              />
            )}

            <PrinterSettingsPanel />
          </>
        )}

        <TseSettingsPanel
          tssId={orgRow?.fiskaly_tss_id ?? null}
          clientId={orgRow?.fiskaly_client_id ?? null}
          steuernummer={orgRow?.steuernummer ?? null}
          ustIdNr={orgRow?.ust_id_nr ?? null}
          platformConfigured={isFiskalyConfigured()}
        />

        <StripeConnectButton
          connected={orgRow?.stripe_onboarded ?? false}
          accountId={orgRow?.stripe_account_id ?? null}
        />

        {locationId && orgRow?.stripe_onboarded && (
          <TerminalReadersPanel
            locationId={locationId}
            stripeConnected={orgRow.stripe_onboarded}
          />
        )}

        <ApiKeysPanel keys={(apiKeys ?? []) as never} canEdit />
        <OperatorApiKeysPanel keys={(operatorApiKeys ?? []) as never} canEdit />
        <OperatorConfigProposalsPanel
          proposals={pendingOperatorProposals}
          previews={operatorProposalPreviews}
          canEdit
        />
        <WebhooksPanel webhooks={(webhooks ?? []) as never} canEdit />
      </div>
    </div>
  );
}
