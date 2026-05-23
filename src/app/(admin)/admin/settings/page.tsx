import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { parseAvailableLocales } from "@/lib/i18n/locale-config";
import { parseLocale } from "@/lib/i18n/detect-locale";
import type { Locale } from "@/lib/i18n/translations";
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
          .select("name, default_locale, available_locales")
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
    default_locale: string | null;
    available_locales: string[] | null;
  } | null;

  const defaultLocale = parseLocale(locationRow?.default_locale) ?? "de";
  const availableLocales = parseAvailableLocales(
    locationRow?.available_locales,
    defaultLocale
  );

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Podešavanja</h1>

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
            availableLocales={availableLocales}
            defaultLocale={defaultLocale}
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
