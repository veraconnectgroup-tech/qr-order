import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import { LocationSettings } from "@/components/admin/location-settings";
import { StripeConnectButton } from "@/components/admin/stripe-connect-button";
import { TseSettingsPanel } from "@/components/admin/tse-settings-panel";

export default async function AdminSettingsPage() {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const locationId = await getStaffLocationId(staff);

  const [{ data: org }, { data: location }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "stripe_account_id, stripe_onboarded, name, email, currency, default_tax_percent, fiskaly_tss_id, fiskaly_client_id"
      )
      .eq("id", staff.org_id)
      .single(),
    locationId
      ? admin
          .from("locations")
          .select("name, menu_locale, default_locale, google_review_url, ordering_enabled")
          .eq("id", locationId)
          .single()
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
  } | null;

  const locationRow = location as {
    name: string;
    menu_locale: string | null;
    default_locale: string | null;
    google_review_url: string | null;
    ordering_enabled: boolean;
  } | null;

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
          <LocationSettings
            locationName={locationRow.name}
            menuLocale={menuLocale}
            googleReviewUrl={locationRow.google_review_url}
            orderingEnabled={locationRow.ordering_enabled}
            canEdit
          />
        )}

        <TseSettingsPanel
          tssId={orgRow?.fiskaly_tss_id ?? null}
          clientId={orgRow?.fiskaly_client_id ?? null}
          platformConfigured={isFiskalyConfigured()}
        />

        <StripeConnectButton
          connected={orgRow?.stripe_onboarded ?? false}
          accountId={orgRow?.stripe_account_id ?? null}
        />
      </div>
    </div>
  );
}
