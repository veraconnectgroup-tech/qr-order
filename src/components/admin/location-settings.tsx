"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateLocationMenuLocale } from "@/lib/admin/location-language-actions";
import { MENU_LOCALES } from "@/lib/i18n/locale-config";
import { LOCALE_LABELS, type MenuLocale } from "@/lib/i18n/translations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LocationSettings({
  locationName,
  menuLocale: initialMenuLocale,
  canEdit,
}: {
  locationName: string;
  menuLocale: MenuLocale;
  canEdit: boolean;
}) {
  const [menuLocale, setMenuLocale] = useState<MenuLocale>(initialMenuLocale);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateLocationMenuLocale(menuLocale);
    setSaving(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Jezik menija sačuvan");
  }

  return (
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Jezik menija</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Gosti na{" "}
        <span className="font-medium text-neutral-700">{locationName}</span>{" "}
        biraju između ovog jezika i engleskog pri prvom otvaranju menija.
      </p>

      <div className="mt-5 space-y-2">
        <Label htmlFor="menu-locale">Primarni jezik</Label>
        <Select
          value={menuLocale}
          onValueChange={(value) => setMenuLocale(value as MenuLocale)}
          disabled={!canEdit}
        >
          <SelectTrigger id="menu-locale" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MENU_LOCALES.map((code) => (
              <SelectItem key={code} value={code}>
                {LOCALE_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-neutral-500">
          Unosite nazive proizvoda na ovom jeziku u polju „
          {LOCALE_LABELS[menuLocale]}“, a prevod na engleskom u polju „English“.
        </p>
      </div>

      {canEdit && (
        <Button
          type="button"
          className="mt-6"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Čuvanje…" : "Sačuvaj"}
        </Button>
      )}
    </div>
  );
}
