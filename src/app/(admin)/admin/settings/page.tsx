import { Suspense } from "react";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import { AiConciergeSettings } from "@/components/admin/ai-concierge-settings";
import { AiPlaybookPanel } from "@/components/admin/ai-playbook-panel";
import { LocationSettings } from "@/components/admin/location-settings";
import { StripeConnectButton } from "@/components/admin/stripe-connect-button";
import { TseSettingsPanel } from "@/components/admin/tse-settings-panel";
import { PrinterSettingsPanel } from "@/components/admin/printer-settings-panel";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { WebhooksPanel } from "@/components/admin/webhooks-panel";
import type { AiCreditPackage } from "@/types";

export default async function AdminSettingsPage() {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const locationId = await getStaffLocationId(staff);

  const [{ data: org }, { data: location }, { data: credits }, { data: packages }, { data: apiKeys }, { data: webhooks }, { data: aiExamples }] =
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
            "name, menu_locale, default_locale, google_review_url, ordering_enabled, ai_concierge_enabled, ai_playbook"
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
    ai_concierge_enabled: boolean;
    ai_playbook: string | null;
  } | null;

  const creditsRow = credits as {
    balance: number;
    lifetime_used: number;
  } | null;

  const creditPackages = (packages ?? []) as AiCreditPackage[];

  const menuLocale = parseMenuLocaleFromDb(
    locationRow?.menu_locale,
    locationRow?.default_locale
  );

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="space-y-6">
        <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Restoran</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Naziv</dt>
              <dd className="font-medium">{orgRow?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Email</dt>
              <dd>{orgRow?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Valuta</dt>
              <dd>{orgRow?.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">PDV</dt>
              <dd>{orgRow?.default_tax_percent}%</dd>
            </div>
          </dl>
        </div>

        {locationRow && (
          <>
            <LocationSettings
              locationName={locationRow.name}
              menuLocale={menuLocale}
              googleReviewUrl={locationRow.google_review_url}
              orderingEnabled={locationRow.ordering_enabled}
              aiConciergeEnabled={locationRow.ai_concierge_enabled}
              canEdit
            />

            <Suspense fallback={null}>
              <AiConciergeSettings
                locationName={locationRow.name}
                creditsBalance={creditsRow?.balance ?? 0}
                creditsLifetimeUsed={creditsRow?.lifetime_used ?? 0}
                packages={creditPackages}
                currency={orgRow?.currency ?? "EUR"}
                canEdit
              />
            </Suspense>

            {locationRow.ai_concierge_enabled && (
              <AiPlaybookPanel
                playbook={locationRow.ai_playbook}
                examples={(aiExamples ?? []) as never}
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

        <ApiKeysPanel keys={(apiKeys ?? []) as never} canEdit />
        <WebhooksPanel webhooks={(webhooks ?? []) as never} canEdit />
      </div>
    </div>
  );
}
