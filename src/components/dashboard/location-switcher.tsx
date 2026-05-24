"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import { switchLocationAction } from "@/lib/dashboard/location-actions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LocationSwitcher({
  locations,
  currentLocationId,
}: {
  locations: Array<{ id: string; name: string }>;
  currentLocationId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (locations.length <= 1) return null;

  const current =
    locations.find((location) => location.id === currentLocationId) ??
    locations[0];

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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className="mt-2 flex w-full min-h-11 items-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-left text-sm text-dash-text-secondary transition hover:bg-dash-surface-raised disabled:opacity-60"
        >
          <MapPin className="size-4 shrink-0 text-dash-accent" />
          <span className="min-w-0 flex-1 truncate">{current.name}</span>
          <ChevronDown className="size-4 shrink-0 text-dash-text-disabled" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] border-dash-surface-overlay bg-dash-surface text-dash-text"
      >
        {locations.map((location) => {
          const active = location.id === currentLocationId;
          return (
            <DropdownMenuItem
              key={location.id}
              className={cn(
                "cursor-pointer focus:bg-dash-surface-raised focus:text-dash-text",
                active && "text-dash-accent"
              )}
              onClick={() => handleSelect(location.id)}
            >
              <Check
                className={cn(
                  "mr-2 size-4",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="truncate">{location.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
