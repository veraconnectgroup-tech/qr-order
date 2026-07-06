"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { Button } from "@/components/ui/button";
import {
  DENIS_AI_CREDITS_PER_TURN,
  DENIS_AI_LOW_BALANCE_THRESHOLD,
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import type { AiCreditPackage } from "@/types";
import { cn } from "@/lib/utils";

export type BillingCreditsSnapshot = {
  balance: number;
  lifetimeUsed: number;
  lifetimePurchased: number;
  lowBalance: boolean;
  turns24h: number | null;
  currency: string;
};

const PACKAGE_PERKS: Record<string, string[]> = {
  Starter: [
    "Great for pilots and small venues",
    "Menu browse without AI is free",
    "Low-balance alerts for staff",
  ],
  Pro: [
    "Best price per credit",
    "Built for daily Denis service",
    "Priority support requests",
  ],
  Enterprise: [
    "High volume and multi-shift ops",
    "Lowest cost per conversation",
    "Chains, events, and peak nights",
  ],
};

const LOCALE = "en-GB";

function packagePerks(name: string): string[] {
  return (
    PACKAGE_PERKS[name] ?? [
      "Available immediately after purchase",
      "1 credit = 1 AI-assisted message",
      "No monthly AI subscription",
    ]
  );
}

function formatCredits(value: number) {
  return value.toLocaleString(LOCALE);
}

function pricePerCredit(priceCents: number, credits: number, currency: string) {
  return `${formatPrice(priceCents / credits / 100, currency, LOCALE)} per credit`;
}

function popularPackageIndex(packages: AiCreditPackage[]) {
  const proIndex = packages.findIndex((pkg) => pkg.name.toLowerCase() === "pro");
  if (proIndex >= 0) return proIndex;
  if (packages.length >= 2) return 1;
  return 0;
}

export function BillingCreditsPanel({
  credits,
  packages,
}: {
  credits: BillingCreditsSnapshot;
  packages: AiCreditPackage[];
}) {
  const searchParams = useSearchParams();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const runwayDays = useMemo(() => {
    if (credits.turns24h == null || credits.turns24h <= 0) return null;
    return Math.max(1, Math.floor(credits.balance / credits.turns24h));
  }, [credits.balance, credits.turns24h]);

  useEffect(() => {
    if (searchParams.get("ai") === "purchased") {
      toast.success("Credits purchased — balance will update shortly.");
    }
    if (searchParams.get("ai") === "cancelled") {
      toast.message("Purchase cancelled.");
    }
  }, [searchParams]);

  async function purchase(packageId: string) {
    setLoadingId(packageId);
    try {
      const res = await fetch("/api/ai/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, returnTo: "billing" }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Purchase failed.");
        return;
      }

      const url = json.data?.url as string | undefined;
      if (!url) {
        toast.error("Could not start checkout.");
        return;
      }

      window.location.href = url;
    } catch {
      toast.error("Purchase failed.");
    } finally {
      setLoadingId(null);
    }
  }

  const popularIndex = popularPackageIndex(packages);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-dash-accent/25 bg-[linear-gradient(135deg,rgba(249,115,22,0.16)_0%,rgba(9,9,11,0.92)_42%,rgba(9,9,11,1)_100%)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-dash-accent/60 to-transparent"
          aria-hidden
        />
        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:p-8">
          <div className="flex min-w-0 items-start gap-4">
            <DenisMarkBadge
              size="lg"
              className="mt-1 bg-dash-accent-muted ring-dash-accent/30"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-accent">
                Denis AI credits
              </p>
              <p className="mt-3 font-mono text-5xl font-bold tabular-nums tracking-tight text-dash-text md:text-6xl">
                {formatCredits(credits.balance)}
              </p>
              <p className="mt-2 text-sm text-dash-text-muted">
                credits available · {DENIS_AI_CREDITS_PER_TURN} credit per AI
                message · menu browse without AI is free
              </p>
              {runwayDays != null && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-dash-text-secondary">
                  <Zap className="size-3.5 text-dash-accent" />
                  ~{runwayDays} day{runwayDays === 1 ? "" : "s"} at current
                  usage
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
            {[
              {
                label: "Used",
                value: formatCredits(credits.lifetimeUsed),
                hint: "Lifetime",
              },
              {
                label: "Purchased",
                value: formatCredits(credits.lifetimePurchased),
                hint: "Top-ups",
              },
              {
                label: "Last 24h",
                value:
                  credits.turns24h != null
                    ? formatCredits(credits.turns24h)
                    : "—",
                hint: "AI turns",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-dash-border/80 bg-dash-surface/50 px-4 py-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-dash-text-muted">
                  {stat.label}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-dash-text">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-dash-text-disabled">
                  {stat.hint}
                </p>
              </div>
            ))}
          </div>
        </div>

        {credits.lowBalance && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-6 py-3 text-sm text-amber-100 lg:px-8">
            Low balance — staff get alerts below{" "}
            {DENIS_AI_LOW_BALANCE_THRESHOLD} credits. Top up before guest AI
            stops.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-dash-text">Credit packs</h3>
            <p className="mt-1 max-w-xl text-sm text-dash-text-muted">
              Pay-as-you-go intelligence for your AI waiter. Pick a pack, pay
              once, use immediately — no monthly AI subscription.
            </p>
          </div>
          <p className="text-xs text-dash-text-disabled">
            Secure checkout via Stripe
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {packages.map((pkg, index) => {
            const isPopular = index === popularIndex && packages.length > 1;
            const perks = packagePerks(pkg.name);
            const currency = pkg.currency || credits.currency;

            return (
              <div
                key={pkg.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-shadow",
                  isPopular
                    ? "border-dash-accent/45 bg-[linear-gradient(180deg,rgba(249,115,22,0.12)_0%,rgba(19,19,22,0.85)_100%)] shadow-[0_24px_60px_-40px_rgba(249,115,22,0.45)]"
                    : "border-dash-border bg-dash-surface/40 hover:border-dash-border-subtle"
                )}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-dash-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    <Sparkles className="size-3" />
                    Best value
                  </span>
                )}

                <div>
                  <p className="text-lg font-semibold text-dash-text">
                    {pkg.name}
                  </p>
                  <p className="mt-1 text-sm text-dash-text-muted">
                    {formatCredits(pkg.credits)} credits
                  </p>
                </div>

                <p className="mt-5 font-mono text-4xl font-bold tabular-nums text-dash-text">
                  {formatPrice(pkg.price_cents / 100, currency, LOCALE)}
                </p>
                <p className="mt-1 text-xs text-dash-text-disabled">
                  {pricePerCredit(pkg.price_cents, pkg.credits, currency)}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2.5 text-sm text-dash-text-secondary"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-dash-accent" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  size="lg"
                  className={cn(
                    "mt-8 w-full",
                    isPopular && "bg-dash-accent hover:bg-dash-accent-hover"
                  )}
                  variant={isPopular ? "default" : "outline"}
                  disabled={loadingId !== null}
                  onClick={() => purchase(pkg.id)}
                >
                  {loadingId === pkg.id
                    ? "Redirecting…"
                    : `Buy ${pkg.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
