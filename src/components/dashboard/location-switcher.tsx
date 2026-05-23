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
          className="mt-2 flex w-full min-h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60"
        >
          <MapPin className="size-4 shrink-0 text-orange-500" />
          <span className="min-w-0 flex-1 truncate">{current.name}</span>
          <ChevronDown className="size-4 shrink-0 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] border-zinc-700 bg-zinc-900 text-zinc-100"
      >
        {locations.map((location) => {
          const active = location.id === currentLocationId;
          return (
            <DropdownMenuItem
              key={location.id}
              className={cn(
                "cursor-pointer focus:bg-zinc-800 focus:text-zinc-50",
                active && "text-orange-400"
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
