"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { switchLocationAction } from "@/lib/dashboard/location-actions";
import type { OrgMultiVenueRoiSummary } from "@/lib/admin/load-org-multi-venue-roi";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatMoney(amount: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency;
  return `${sym}${Math.round(amount).toLocaleString("de-DE")}`;
}

export function AdminVenueHubSelector({
  summary,
  currentLocationId,
  showAllLink = true,
}: {
  summary: OrgMultiVenueRoiSummary;
  currentLocationId: string;
  showAllLink?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const current =
    summary.venues.find((venue) => venue.locationId === currentLocationId) ??
    summary.venues[0];

  function handleSelect(locationId: string) {
    if (locationId === currentLocationId || pending) return;
    startTransition(async () => {
      const result = await switchLocationAction(locationId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-dash-border bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Multi-venue
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.monthLabel} — Denis ROI po lokaciji
          </p>
        </div>
        {showAllLink ? (
          <Link
            href="/admin"
            className="text-sm font-medium text-dash-accent hover:underline"
          >
            Svi restorani
          </Link>
        ) : null}
      </div>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={pending}
            className="mt-3 flex w-full min-h-11 items-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-left text-sm disabled:opacity-60"
          >
            <Building2 className="size-4 shrink-0 text-dash-accent" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {current?.locationName ?? "Izaberi restoran"}
            </span>
            {current ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatMoney(current.monthlyRevenueEuros, summary.currency)}/mesec · ROI{" "}
                {current.roiMultiplier}x
              </span>
            ) : null}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[320px]"
        >
          <DropdownMenuLabel>Svi restorani</DropdownMenuLabel>
          {summary.venues.map((venue) => {
            const active = venue.locationId === currentLocationId;
            return (
              <DropdownMenuItem
                key={venue.locationId}
                className={cn(
                  "cursor-pointer items-start gap-2 py-2.5",
                  active && "bg-dash-accent/10"
                )}
                onClick={() => handleSelect(venue.locationId)}
              >
                <Check
                  className={cn("mt-0.5 size-4 shrink-0", active ? "opacity-100" : "opacity-0")}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{venue.locationName}</p>
                  {venue.city ? (
                    <p className="truncate text-xs text-muted-foreground">{venue.city}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  <p>{formatMoney(venue.monthlyRevenueEuros, summary.currency)}/mesec</p>
                  <p className="font-medium text-foreground">ROI: {venue.roiMultiplier}x</p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <div className="px-2 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              UKUPNO: {formatMoney(summary.totals.monthlyRevenueEuros, summary.currency)}/mesec
            </p>
            <p>Prosečan ROI: {summary.totals.avgRoiMultiplier}x</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {summary.venues.slice(0, 3).map((venue) => (
          <button
            key={venue.locationId}
            type="button"
            disabled={pending || venue.locationId === currentLocationId}
            onClick={() => handleSelect(venue.locationId)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition",
              venue.locationId === currentLocationId
                ? "border-dash-accent/40 bg-dash-accent/10"
                : "border-border/60 hover:bg-muted/40"
            )}
          >
            <p className="truncate font-medium">{venue.locationName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatMoney(venue.monthlyRevenueEuros, summary.currency)}/mesec · ROI{" "}
              {venue.roiMultiplier}x
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
