"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { OrgTrialStatus, PlatformOrgRow } from "@/lib/platform/platform-stats";
import { formatPrice } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: OrgTrialStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "trial", label: "Trial" },
  { key: "expired", label: "Expired" },
  { key: "setup", label: "Setup" },
];

const STATUS_COLORS: Record<OrgTrialStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  trial: "bg-amber-100 text-amber-800",
  expired: "bg-red-100 text-red-800",
  setup: "bg-neutral-100 text-neutral-700",
};

export function OrgListTable({ orgs }: { orgs: PlatformOrgRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const filter = (searchParams.get("filter") as OrgTrialStatus | "all") || "all";
  const search = searchParams.get("q") ?? "";

  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        router.replace(`/platform/orgs?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name, slug, or email…"
          defaultValue={search}
          onChange={(e) => updateParams({ q: e.target.value || null })}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => updateParams({ filter: key === "all" ? null : key })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                (filter === key || (key === "all" && filter === "all"))
                  ? "bg-violet-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/platform/orgs/${org.id}`}
                    className="font-medium text-violet-700 hover:underline"
                  >
                    {org.name}
                  </Link>
                  <p className="text-xs text-neutral-500">{org.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_COLORS[org.trial_status]
                    )}
                  >
                    {org.trial_status}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{org.order_count}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatPrice(org.revenue, org.currency)}
                </td>
                <td className="px-4 py-3">
                  {org.stripe_onboarded ? (
                    <span className="text-emerald-600">Connected</span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-500">
            No organizations match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
