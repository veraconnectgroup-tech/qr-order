"use client";

import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { assignStaffLocationsAction } from "@/lib/dashboard/staff-location-actions";
import { isFloatingStaff } from "@/lib/staff/staff-locations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LocationOption = { id: string; name: string };

export function StaffLocationsEditor({
  staffId,
  staffName,
  currentLocationIds,
  allLocations,
  disabled,
}: {
  staffId: string;
  staffName: string;
  currentLocationIds: string[];
  allLocations: LocationOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentLocationIds);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await assignStaffLocationsAction({
        staffId,
        locationIds: selected,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location assignments updated.");
      setOpen(false);
    });
  }

  const label =
    currentLocationIds.length === 0
      ? "No locations"
      : isFloatingStaff(currentLocationIds)
        ? `Floating (${currentLocationIds.length})`
        : allLocations.find((l) => l.id === currentLocationIds[0])?.name ??
          "1 location";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(currentLocationIds);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 gap-1.5 text-xs text-dash-text-muted"
        >
          <MapPin className="size-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-dash-border bg-dash-surface text-dash-text">
        <DialogHeader>
          <DialogTitle>Locations — {staffName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-dash-text-muted">
          Assign one or more venues. Floating staff can switch between assigned
          locations.
        </p>
        <div className="space-y-2 py-2">
          {allLocations.map((loc) => (
            <label
              key={loc.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-dash-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(loc.id)}
                onChange={() => toggle(loc.id)}
              />
              {loc.name}
            </label>
          ))}
        </div>
        <Button type="button" disabled={pending} onClick={handleSave}>
          Save assignments
        </Button>
      </DialogContent>
    </Dialog>
  );
}
