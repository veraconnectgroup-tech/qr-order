"use client";

import { useState, useTransition } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createLocation,
  setLocationActive,
  updateLocation,
} from "@/lib/admin/location-actions";
import { VenuePlaybookWizard } from "@/components/admin/venue-playbook-wizard";
import { VenueTemplatePicker } from "@/components/admin/venue-template-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  is_active: boolean;
  created_at: string;
};

function LocationDialog({
  open,
  location,
  onClose,
  onSaved,
}: {
  open: boolean;
  location: LocationRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const isEdit = !!location;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (templateId) {
      formData.set("template_id", templateId);
    }
    startTransition(async () => {
      const result = isEdit
        ? await updateLocation(location!.id, formData)
        : await createLocation(formData);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      if (!isEdit && "data" in result && result.data?.id) {
        if (result.data.templateApplied) {
          toast.success("Location created — Denis template applied");
          onSaved();
          onClose();
          return;
        }
        setCreatedLocationId(result.data.id);
        toast.success("Location created — set up Denis playbook");
        return;
      }

      toast.success(isEdit ? "Location updated" : "Location created");
      onSaved();
      onClose();
    });
  }

  function finishPlaybookOnboarding() {
    toast.success("Playbook saved for new location");
    setCreatedLocationId(null);
    onSaved();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setCreatedLocationId(null);
          setTemplateId(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit location" : "Create location"}
          </DialogTitle>
        </DialogHeader>
        {createdLocationId ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Denis can draft playbook rules from five quick questions. You can
              edit them anytime under Settings → Denis Playbook.
            </p>
            <VenuePlaybookWizard
              canEdit
              locationId={createdLocationId}
              onApplied={() => finishPlaybookOnboarding()}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={finishPlaybookOnboarding}>
                Skip for now
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit ? (
            <VenueTemplatePicker value={templateId} onChange={setTemplateId} />
          ) : null}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">
              Name
            </label>
            <input
              name="name"
              required
              defaultValue={location?.name ?? ""}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">
              Address
            </label>
            <input
              name="address"
              defaultValue={location?.address ?? ""}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">
                City
              </label>
              <input
                name="city"
                defaultValue={location?.city ?? ""}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">
                Postal code
              </label>
              <input
                name="postal_code"
                defaultValue={location?.postal_code ?? ""}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-foreground/90">
              <input
                type="checkbox"
                name="is_active"
                value="true"
                defaultChecked={location?.is_active ?? true}
              />
              Active
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function LocationsManager({ locations }: { locations: LocationRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [togglePending, startToggleTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(location: LocationRow) {
    setEditing(location);
    setDialogOpen(true);
  }

  function toggleActive(location: LocationRow) {
    startToggleTransition(async () => {
      const result = await setLocationActive(location.id, !location.is_active);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(location.is_active ? "Location deactivated" : "Location activated");
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage venues in your organization. Each location has its own menu,
            tables, and staff access.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 size-4" />
          Add location
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  No locations yet.
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr
                  key={location.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <MapPin className="size-4 text-blue-600" />
                      {location.name}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {[location.address, location.city, location.postal_code]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        location.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {location.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(location)}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={togglePending}
                        onClick={() => toggleActive(location)}
                      >
                        {location.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LocationDialog
        open={dialogOpen}
        location={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {}}
      />
    </div>
  );
}
