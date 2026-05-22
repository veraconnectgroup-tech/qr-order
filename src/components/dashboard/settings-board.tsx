"use client";

import { Suspense, useState } from "react";
import { Copy, LogOut, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/lib/auth/actions";
import { updateOrganizationSettings, setLocationOrderingActive } from "@/lib/dashboard/settings-actions";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useAppBaseUrl } from "@/hooks/use-app-base-url";
import { guestTableUrl } from "@/lib/app-url";
import { DashboardStripeConnect } from "@/components/dashboard/dashboard-stripe-connect";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type OrgSettings = {
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  currency: string;
  default_tax_percent: number;
  stripe_onboarded: boolean;
  stripe_account_id: string | null;
};

type LocationInfo = {
  name: string;
  address: string | null;
  city: string | null;
  is_active: boolean;
  accepting_orders: boolean;
};

export function SettingsBoard({
  org,
  location,
  staffName,
  staffRole,
  staffEmail,
  canEdit,
}: {
  org: OrgSettings;
  location: LocationInfo | null;
  staffName: string;
  staffRole: string;
  staffEmail: string | null;
  canEdit: boolean;
}) {
  const { enabled, toggle } = useSoundAlert();
  const appUrl = useAppBaseUrl();
  const [saving, setSaving] = useState(false);
  const [orderingActive, setOrderingActive] = useState(
    location?.accepting_orders ?? true
  );
  const [togglingOrders, setTogglingOrders] = useState(false);
  const guestMenuUrl = guestTableUrl(org.slug, "demo-table-8", appUrl);

  async function handleSave(formData: FormData) {
    setSaving(true);
    const result = await updateOrganizationSettings(formData);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Settings saved");
  }

  function copyGuestUrl() {
    navigator.clipboard.writeText(guestMenuUrl);
    toast.success("Guest menu URL copied");
  }

  async function handleOrderingToggle(checked: boolean) {
    setTogglingOrders(true);
    const result = await setLocationOrderingActive(checked);
    setTogglingOrders(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setOrderingActive(checked);
    toast.success(checked ? "Guest ordering is open" : "Guest ordering paused");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-0 sm:space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-50">Restaurant</h2>
        {canEdit ? (
          <form action={handleSave} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Name</span>
              <input
                name="name"
                defaultValue={org.name}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Email</span>
              <input
                name="email"
                type="email"
                defaultValue={org.email ?? ""}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Phone</span>
              <input
                name="phone"
                defaultValue={org.phone ?? ""}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Description</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={org.description ?? ""}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm text-zinc-400">Tax rate (%)</span>
                <input
                  name="default_tax_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={org.default_tax_percent}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
                />
              </label>
              <div className="space-y-1.5">
                <span className="text-sm text-zinc-400">Currency</span>
                <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-500">
                  {org.currency}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
              <span>
                Slug:{" "}
                <span className="font-mono text-zinc-400">{org.slug}</span>
              </span>
              {location && (
                <span>
                  Location:{" "}
                  <span className="text-zinc-400">
                    {location.name}
                    {location.city ? ` · ${location.city}` : ""}
                  </span>
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        ) : (
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Name", org.name],
              ["Email", org.email ?? "—"],
              ["Phone", org.phone ?? "—"],
              ["Currency", org.currency],
              ["Tax", `${org.default_tax_percent}%`],
              ["Slug", org.slug],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-zinc-500">{label}</dt>
                <dd className="text-right text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-50">Guest menu link</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Share or test the QR guest experience
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            {guestMenuUrl.replace(/^https?:\/\//, "")}
          </code>
          <button
            type="button"
            onClick={copyGuestUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <Copy className="size-4" />
            Copy
          </button>
        </div>
      </section>

      {canEdit && location && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">
                Guest ordering
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Pause new orders during breaks or when the kitchen is closed.
                Waiter calls still work.
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Status:{" "}
                <span
                  className={
                    orderingActive ? "text-emerald-400" : "text-amber-400"
                  }
                >
                  {orderingActive ? "Accepting orders" : "Paused"}
                </span>
              </p>
            </div>
            <Switch
              checked={orderingActive}
              disabled={togglingOrders}
              onCheckedChange={handleOrderingToggle}
            />
          </div>
        </section>
      )}

      {canEdit && (
        <Suspense
          fallback={
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
              Loading payments…
            </div>
          }
        >
          <DashboardStripeConnect
            connected={org.stripe_onboarded}
            accountId={org.stripe_account_id}
          />
        </Suspense>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
              <Volume2 className="size-5 text-zinc-400" />
              Sound alerts
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Play sounds for new orders and waiter calls on this device
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-50">Your account</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-zinc-200">{staffName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Role</dt>
            <dd className="capitalize text-zinc-200">{staffRole}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{staffEmail ?? "—"}</dd>
          </div>
        </dl>
        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            )}
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
