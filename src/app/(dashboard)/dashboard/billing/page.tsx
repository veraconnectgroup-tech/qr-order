import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { buildConsolidatedOrgInvoice } from "@/lib/billing/consolidated-invoice";
import { loadBillingDashboard } from "@/lib/billing/snapshot";
import { maybeEnqueueBillingAlerts } from "@/lib/billing/notifications";
import { formatPrice } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingDashboard } from "@/components/dashboard/billing/billing-dashboard";

export default async function BillingPage() {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    redirect("/dashboard/orders");
  }

  const admin = createAdminClient();
  const [data, consolidated] = await Promise.all([
    loadBillingDashboard(staff.org_id),
    buildConsolidatedOrgInvoice(admin, staff.org_id),
  ]);

  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", staff.org_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (location) {
    await maybeEnqueueBillingAlerts(admin, {
      orgId: staff.org_id,
      locationId: (location as { id: string }).id,
      planId: data.org.planId,
      trialEndsAt: data.org.trialEndsAt,
      subscriptionStatus: data.org.subscriptionStatus,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">Billing</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Plan, usage, Denis ROI, and revenue share — all in one place.
        </p>
      </div>

      <BillingDashboard data={data} />

      {consolidated.locations.length > 1 && (
        <section className="rounded-xl border border-dash-border bg-dash-surface/60 p-6">
          <h2 className="text-lg font-semibold text-dash-text">
            Consolidated invoice — {consolidated.periodLabel}
          </h2>
          <p className="mt-1 text-sm text-dash-text-muted">
            One invoice for all locations under {consolidated.orgName}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-dash-border text-left text-xs uppercase tracking-wider text-dash-text-disabled">
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Orders</th>
                  <th className="py-2 pr-4">GMV</th>
                  <th className="py-2">Platform fee</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.locations.map((line) => (
                  <tr key={line.locationId} className="border-b border-dash-border/50">
                    <td className="py-2 pr-4 text-dash-text">{line.locationName}</td>
                    <td className="py-2 pr-4">{line.orderCount}</td>
                    <td className="py-2 pr-4">
                      {formatPrice(line.grossRevenue, consolidated.currency)}
                    </td>
                    <td className="py-2">
                      {formatPrice(line.platformFee, consolidated.currency)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-dash-text">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4">{consolidated.totals.orderCount}</td>
                  <td className="py-2 pr-4">
                    {formatPrice(consolidated.totals.grossRevenue, consolidated.currency)}
                  </td>
                  <td className="py-2">
                    {formatPrice(consolidated.totals.platformFee, consolidated.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
