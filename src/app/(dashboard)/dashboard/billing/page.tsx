import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { loadActivePlans, loadPlanById } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice, fromCents } from "@/lib/format";
import { cn } from "@/lib/utils";

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function upgradeMailto(orgName: string, planName: string) {
  const subject = `Plan Upgrade: ${orgName} -> ${planName}`;
  return `mailto:jovica@verait.de?subject=${encodeURIComponent(subject)}`;
}

export default async function BillingPage() {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    redirect("/dashboard/orders");
  }

  const admin = createAdminClient();
  const [{ data: org }, plans] = await Promise.all([
    admin
      .from("organizations")
      .select("name, plan_id, subscription_status, trial_ends_at, currency")
      .eq("id", staff.org_id)
      .single(),
    loadActivePlans(),
  ]);

  const orgRow = org as {
    name: string;
    plan_id: string | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
    currency: string;
  } | null;

  const currentPlanId = orgRow?.plan_id ?? "starter";
  const currentPlan =
    plans.find((plan) => plan.id === currentPlanId) ??
    (await loadPlanById(currentPlanId));
  const subscriptionStatus = orgRow?.subscription_status ?? "trialing";
  const daysLeft = trialDaysLeft(orgRow?.trial_ends_at ?? null);
  const isTrialing = subscriptionStatus === "trialing";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Billing</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plan, Testphase und Upgrades verwalten.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Aktueller Plan</h2>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-zinc-50">
              {currentPlan?.name ?? "Starter"}
            </p>
            {currentPlan && (
              <p className="mt-1 text-sm text-zinc-400">
                {formatPrice(fromCents(currentPlan.price_cents), currentPlan.currency)}
                /{currentPlan.interval === "year" ? "Jahr" : "Monat"}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-zinc-400">
            <p className="capitalize">Status: {subscriptionStatus}</p>
            {isTrialing && (
              <p className="mt-1 text-amber-300">
                14 Tage Testphase
                {daysLeft !== null && daysLeft > 0 && (
                  <> · noch {daysLeft} Tag{daysLeft === 1 ? "" : "e"}</>
                )}
                {daysLeft !== null && daysLeft <= 0 && <> · abgelaufen</>}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">Pläne vergleichen</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const canUpgrade = plan.sort_order > (currentPlan?.sort_order ?? 0);

            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border p-6",
                  isCurrent
                    ? "border-orange-500/40 bg-orange-500/5"
                    : "border-zinc-800 bg-zinc-900/60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-zinc-100">{plan.name}</h3>
                  {isCurrent && (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-400">
                      Aktuell
                    </span>
                  )}
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-zinc-50">
                  {formatPrice(fromCents(plan.price_cents), plan.currency)}
                  <span className="text-sm font-normal text-zinc-500">
                    /{plan.interval === "year" ? "Jahr" : "Mo."}
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-zinc-300"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <span className="block rounded-lg border border-zinc-700 px-4 py-2.5 text-center text-sm text-zinc-400">
                      Ihr aktueller Plan
                    </span>
                  ) : canUpgrade ? (
                    <a
                      href={upgradeMailto(orgRow?.name ?? "Restaurant", plan.name)}
                      className="block rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-orange-600"
                    >
                      Upgrade
                    </a>
                  ) : (
                    <span className="block rounded-lg border border-zinc-700 px-4 py-2.5 text-center text-sm text-zinc-500">
                      Enthalten in höherem Plan
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
