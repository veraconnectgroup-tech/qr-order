"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { updateLocationLanguages } from "@/lib/admin/location-language-actions";
import { ALL_LOCALES } from "@/lib/i18n/locale-config";
import { LOCALE_META, type Locale } from "@/lib/i18n/translations";
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
  availableLocales: initialAvailable,
  defaultLocale: initialDefault,
  canEdit,
}: {
  locationName: string;
  availableLocales: Locale[];
  defaultLocale: Locale;
  canEdit: boolean;
}) {
  const [availableLocales, setAvailableLocales] = useState<Locale[]>(
    initialAvailable.length > 0 ? initialAvailable : [initialDefault]
  );
  const [defaultLocale, setDefaultLocale] = useState<Locale>(initialDefault);
  const [saving, setSaving] = useState(false);

  const sortedAvailable = useMemo(
    () =>
      [...availableLocales].sort(
        (a, b) => ALL_LOCALES.indexOf(a) - ALL_LOCALES.indexOf(b)
      ),
    [availableLocales]
  );

  function toggleLocale(code: Locale, checked: boolean) {
    setAvailableLocales((current) => {
      if (checked) {
        return current.includes(code) ? current : [...current, code];
      }
      const next = current.filter((item) => item !== code);
      return next.length > 0 ? next : [defaultLocale];
    });
  }

  async function handleSave() {
    if (availableLocales.length === 0) {
      toast.error("Izaberite bar jedan jezik.");
      return;
    }
    if (!availableLocales.includes(defaultLocale)) {
      toast.error("Podrazumevani jezik mora biti među dostupnim.");
      return;
    }

    setSaving(true);
    const result = await updateLocationLanguages({
      availableLocales,
      defaultLocale,
    });
    setSaving(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Jezici sačuvani");
  }

  return (
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Jezici</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Gosti na <span className="font-medium text-neutral-700">{locationName}</span>{" "}
        vide samo izabrane jezike u meniju i tokom poručivanja.
      </p>

      <div className="mt-5 space-y-2">
        <Label className="text-neutral-700">Dostupni jezici</Label>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ALL_LOCALES.map((code) => {
            const checked = availableLocales.includes(code);
            const disabled =
              !canEdit || (checked && availableLocales.length === 1);
            return (
              <li key={code}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggleLocale(code, e.target.checked)}
                    className="size-4 rounded border-neutral-300"
                  />
                  <span>{LOCALE_META[code].label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="default-locale">Podrazumevani jezik</Label>
        <Select
          value={defaultLocale}
          onValueChange={(value) => setDefaultLocale(value as Locale)}
          disabled={!canEdit}
        >
          <SelectTrigger id="default-locale" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortedAvailable.map((code) => (
              <SelectItem key={code} value={code}>
                {LOCALE_META[code].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-neutral-500">
          Koristi se kada gost prvi put otvori meni, pre nego što izabere jezik.
        </p>
      </div>

      {canEdit && (
        <Button
          type="button"
          className="mt-6"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Čuvanje…" : "Sačuvaj jezike"}
        </Button>
      )}
    </div>
  );
}
