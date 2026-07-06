"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import {
  ArrowRight,
  Copy,
  CreditCard,
  LogOut,
  Settings2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/lib/auth/actions";
import {
  setLocationOrderingActive,
  updateLocationPaymentMethods,
  updateOrganizationSettings,
} from "@/lib/dashboard/settings-actions";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useAppBaseUrl } from "@/hooks/use-app-base-url";
import { guestTableUrl } from "@/lib/app-url";
import { DashboardStripeConnect } from "@/components/dashboard/dashboard-stripe-connect";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import type { InPersonPaymentLocation } from "@/lib/constants";
import { cn } from "@/lib/utils";

const IN_PERSON_LOCATION_OPTIONS: Array<{
  id: InPersonPaymentLocation;
  label: string;
  hint: string;
}> = [
  { id: "bar", label: "At the bar", hint: "Guests pay at the bar" },
  { id: "counter", label: "At the counter", hint: "Guests pay at the counter" },
  { id: "table", label: "At the table", hint: "Staff collects payment at the table" },
];

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
  payment_online_enabled: boolean;
  payment_at_bar_enabled: boolean;
  payment_card_at_table_enabled: boolean;
  in_person_payment_location: InPersonPaymentLocation;
};

const inputClassName =
  "w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent";

export function SettingsBoardView({
  org,
  location,
  staffName,
  staffRole,
  staffEmail,
  canEdit,
  canManageBilling,
  stripePlatformReady,
  sampleTableToken,
}: {
  org: OrgSettings;
  location: LocationInfo | null;
  staffName: string;
  staffRole: string;
  staffEmail: string | null;
  canEdit: boolean;
  canManageBilling: boolean;
  stripePlatformReady: boolean;
  sampleTableToken: string | null;
}) {
  const { enabled, toggle } = useSoundAlert();
  const appUrl = useAppBaseUrl();
  const [saving, setSaving] = useState(false);
  const [orderingActive, setOrderingActive] = useState(
    location?.accepting_orders ?? true
  );
  const [togglingOrders, setTogglingOrders] = useState(false);
  const [paymentOnline, setPaymentOnline] = useState(
    location?.payment_online_enabled ?? true
  );
  const [paymentAtBar, setPaymentAtBar] = useState(
    location?.payment_at_bar_enabled ?? true
  );
  const [paymentCardAtTable, setPaymentCardAtTable] = useState(
    location?.payment_card_at_table_enabled ?? true
  );
  const [inPersonLocation, setInPersonLocation] = useState<InPersonPaymentLocation>(
    location?.in_person_payment_location ?? "bar"
  );
  const [savingPayments, setSavingPayments] = useState(false);

  const guestMenuUrl = sampleTableToken
    ? guestTableUrl(org.slug, sampleTableToken, appUrl)
    : null;

  async function handleSave(formData: FormData) {
    setSaving(true);
    const result = await updateOrganizationSettings(formData);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Venue details saved");
  }

  function copyGuestUrl() {
    if (!guestMenuUrl) return;
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

  async function handlePaymentMethodChange(
    key: "online" | "atBar" | "cardAtTable",
    checked: boolean
  ) {
    await savePaymentSettings({
      online: key === "online" ? checked : paymentOnline,
      atBar: key === "atBar" ? checked : paymentAtBar,
      cardAtTable: key === "cardAtTable" ? checked : paymentCardAtTable,
      location: inPersonLocation,
    });
  }

  async function handleInPersonLocationChange(
    nextLocation: InPersonPaymentLocation
  ) {
    setInPersonLocation(nextLocation);
    await savePaymentSettings({
      online: paymentOnline,
      atBar: paymentAtBar,
      cardAtTable: paymentCardAtTable,
      location: nextLocation,
    });
  }

  async function savePaymentSettings(next: {
    online: boolean;
    atBar: boolean;
    cardAtTable: boolean;
    location: InPersonPaymentLocation;
  }) {
    if (!next.online && !next.atBar && !next.cardAtTable) {
      toast.error("At least one payment method must stay enabled.");
      return;
    }

    setSavingPayments(true);
    const result = await updateLocationPaymentMethods({
      paymentOnlineEnabled: next.online,
      paymentAtBarEnabled: next.atBar,
      paymentCardAtTableEnabled: next.cardAtTable,
      inPersonPaymentLocation: next.location,
    });
    setSavingPayments(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    setPaymentOnline(next.online);
    setPaymentAtBar(next.atBar);
    setPaymentCardAtTable(next.cardAtTable);
    setInPersonLocation(next.location);
    toast.success("Payment methods updated");
  }

  return (
    <Tabs defaultValue="venue" className="space-y-6">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-dash-border bg-dash-surface/60 p-1 sm:w-auto">
        <TabsTrigger
          value="venue"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-accent data-[state=active]:text-white"
        >
          Venue
        </TabsTrigger>
        <TabsTrigger
          value="guest"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-surface-overlay data-[state=active]:text-dash-text"
        >
          Guest checkout
        </TabsTrigger>
        <TabsTrigger
          value="payments"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-surface-overlay data-[state=active]:text-dash-text"
        >
          Payments
        </TabsTrigger>
        <TabsTrigger
          value="account"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-surface-overlay data-[state=active]:text-dash-text"
        >
          Account
        </TabsTrigger>
      </TabsList>

      <TabsContent value="venue" className="mt-0 space-y-6 focus-visible:outline-none">
        <QrCard variant="muted" padding="md">
          <QrCardTitle className="text-base">Venue details</QrCardTitle>
          <QrCardDescription>
            Public-facing restaurant info used on receipts and guest flows.
          </QrCardDescription>

          {canEdit ? (
            <form action={handleSave} className="mt-5 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm text-dash-text-muted">Name</span>
                <input
                  name="name"
                  defaultValue={org.name}
                  required
                  className={inputClassName}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm text-dash-text-muted">Email</span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={org.email ?? ""}
                    className={inputClassName}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm text-dash-text-muted">Phone</span>
                  <input
                    name="phone"
                    defaultValue={org.phone ?? ""}
                    className={inputClassName}
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm text-dash-text-muted">Description</span>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={org.description ?? ""}
                  className={inputClassName}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm text-dash-text-muted">Tax rate (%)</span>
                  <input
                    name="default_tax_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={org.default_tax_percent}
                    className={inputClassName}
                  />
                </label>
                <div className="space-y-1.5">
                  <span className="text-sm text-dash-text-muted">Currency</span>
                  <p className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text-disabled">
                    {org.currency}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-dash-text-disabled">
                <span>
                  Slug:{" "}
                  <span className="font-mono text-dash-text-muted">{org.slug}</span>
                </span>
                {location && (
                  <span>
                    Location:{" "}
                    <span className="text-dash-text-muted">
                      {location.name}
                      {location.city ? ` · ${location.city}` : ""}
                    </span>
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save venue details"}
              </button>
            </form>
          ) : (
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ["Name", org.name],
                ["Email", org.email ?? "—"],
                ["Phone", org.phone ?? "—"],
                ["Currency", org.currency],
                ["Tax", `${org.default_tax_percent}%`],
                ["Slug", org.slug],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-dash-text-disabled">{label}</dt>
                  <dd className="text-right text-dash-text-secondary">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </QrCard>

        <QrCard variant="muted" padding="md">
          <QrCardTitle className="text-base">Guest menu link</QrCardTitle>
          <QrCardDescription>
            Share or test the QR guest experience for one of your tables.
          </QrCardDescription>
          {guestMenuUrl ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-xs text-dash-text-muted">
                {guestMenuUrl.replace(/^https?:\/\//, "")}
              </code>
              <button
                type="button"
                onClick={copyGuestUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-dash-surface-raised px-3 py-2 text-sm text-dash-text-secondary hover:bg-dash-surface-overlay"
              >
                <Copy className="size-4" />
                Copy
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-dash-text-muted">
              Add a table on the{" "}
              <Link href="/dashboard/tables" className="text-dash-accent hover:underline">
                Tables
              </Link>{" "}
              page to get your guest menu URL and QR codes.
            </p>
          )}
        </QrCard>
      </TabsContent>

      <TabsContent value="guest" className="mt-0 space-y-6 focus-visible:outline-none">
        {canEdit && location ? (
          <>
            <QrCard variant="muted" padding="md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <QrCardTitle className="text-base">Guest ordering</QrCardTitle>
                  <QrCardDescription>
                    Pause new orders during breaks or when the kitchen is closed.
                    Waiter calls still work.
                  </QrCardDescription>
                  <p className="mt-3 text-xs text-dash-text-disabled">
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
            </QrCard>

            <QrCard variant="muted" padding="md">
              <QrCardTitle className="text-base">Payment methods</QrCardTitle>
              <QrCardDescription>
                Choose which options guests see at checkout.
              </QrCardDescription>
              <div className="mt-4 divide-y divide-dash-border rounded-lg border border-dash-border">
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-dash-text-secondary">
                        Pay in person
                      </p>
                      <p className="text-xs text-dash-text-disabled">
                        Guest orders now and pays later on site
                      </p>
                    </div>
                    <Switch
                      checked={paymentAtBar}
                      disabled={savingPayments}
                      onCheckedChange={(checked) =>
                        handlePaymentMethodChange("atBar", checked)
                      }
                    />
                  </div>
                  {paymentAtBar && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-dash-text-muted">
                        Where do guests pay?
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {IN_PERSON_LOCATION_OPTIONS.map((option) => {
                          const selected = inPersonLocation === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={savingPayments}
                              onClick={() => handleInPersonLocationChange(option.id)}
                              className={cn(
                                "rounded-lg border px-3 py-2.5 text-left transition",
                                selected
                                  ? "border-dash-accent bg-dash-accent-muted"
                                  : "border-dash-border bg-dash-bg hover:border-dash-surface-overlay"
                              )}
                            >
                              <span className="block text-sm font-medium text-dash-text-secondary">
                                {option.label}
                              </span>
                              <span className="mt-0.5 block text-xs text-dash-text-disabled">
                                {option.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-dash-text-secondary">Card</p>
                    <p className="text-xs text-dash-text-disabled">
                      Card payment — staff brings a terminal to the table
                    </p>
                  </div>
                  <Switch
                    checked={paymentCardAtTable}
                    disabled={savingPayments}
                    onCheckedChange={(checked) =>
                      handlePaymentMethodChange("cardAtTable", checked)
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-dash-text-secondary">
                      Pay online
                    </p>
                    <p className="text-xs text-dash-text-disabled">
                      Apple Pay, Google Pay, and cards via Stripe
                      {!org.stripe_onboarded && " — connect Stripe in Payments first"}
                    </p>
                  </div>
                  <Switch
                    checked={paymentOnline}
                    disabled={savingPayments || !org.stripe_onboarded}
                    onCheckedChange={(checked) =>
                      handlePaymentMethodChange("online", checked)
                    }
                  />
                </div>
              </div>
            </QrCard>
          </>
        ) : (
          <QrCard variant="muted" padding="md">
            <p className="text-sm text-dash-text-muted">
              Only owners and managers can change guest checkout settings.
            </p>
          </QrCard>
        )}
      </TabsContent>

      <TabsContent value="payments" className="mt-0 space-y-6 focus-visible:outline-none">
        {canEdit ? (
          <>
            <Suspense
              fallback={
                <QrCard variant="muted" padding="md">
                  <p className="text-sm text-dash-text-disabled">Loading payments…</p>
                </QrCard>
              }
            >
              <DashboardStripeConnect
                connected={org.stripe_onboarded}
                accountId={org.stripe_account_id}
                platformReady={stripePlatformReady}
                currency={org.currency}
              />
            </Suspense>

            {canManageBilling && (
              <Link
                href="/dashboard/billing"
                className="group flex items-center justify-between rounded-xl border border-dash-border bg-dash-surface/40 p-5 transition hover:border-dash-accent/30 hover:bg-dash-surface/60"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-dash-accent-muted ring-1 ring-dash-accent/20">
                    <CreditCard className="size-5 text-dash-accent" />
                  </span>
                  <div>
                    <p className="font-medium text-dash-text">Billing & AI credits</p>
                    <p className="mt-1 text-sm text-dash-text-muted">
                      Buy Denis credit packs, view usage, and manage your platform
                      plan.
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-dash-text-disabled transition group-hover:text-dash-accent" />
              </Link>
            )}
          </>
        ) : (
          <QrCard variant="muted" padding="md">
            <p className="text-sm text-dash-text-muted">
              Only owners and managers can connect Stripe or open billing.
            </p>
          </QrCard>
        )}
      </TabsContent>

      <TabsContent value="account" className="mt-0 space-y-6 focus-visible:outline-none">
        <QrCard variant="muted" padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <QrCardTitle className="flex items-center gap-2 text-base">
                <Volume2 className="size-5 text-dash-text-muted" />
                Sound alerts
              </QrCardTitle>
              <QrCardDescription>
                Play sounds for new orders and waiter calls on this device.
              </QrCardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={toggle} />
          </div>
        </QrCard>

        <QrCard variant="muted" padding="md">
          <QrCardTitle className="text-base">Your account</QrCardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-dash-text-disabled">Name</dt>
              <dd className="text-dash-text-secondary">{staffName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dash-text-disabled">Role</dt>
              <dd className="capitalize text-dash-text-secondary">{staffRole}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dash-text-disabled">Email</dt>
              <dd className="text-dash-text-secondary">{staffEmail ?? "—"}</dd>
            </div>
          </dl>
          <form action={logoutAction} className="mt-6">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-dash-surface-overlay px-4 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-raised hover:text-dash-text"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </QrCard>

        <Link
          href="/admin/settings"
          className="group flex items-center justify-between rounded-xl border border-dash-border bg-dash-surface/40 p-5 transition hover:border-dash-accent/30 hover:bg-dash-surface/60"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-dash-surface-raised ring-1 ring-dash-border">
              <Settings2 className="size-5 text-dash-text-muted" />
            </span>
            <div>
              <p className="font-medium text-dash-text">Advanced admin settings</p>
              <p className="mt-1 text-sm text-dash-text-muted">
                Denis playbook, fiscal/TSE, printers, API keys, and integrations.
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 text-dash-text-disabled transition group-hover:text-dash-accent" />
        </Link>
      </TabsContent>
    </Tabs>
  );
}
