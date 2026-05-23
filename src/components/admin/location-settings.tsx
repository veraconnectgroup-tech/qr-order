"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  updateLocationGoogleReviewUrl,
  updateLocationMenuLocale,
  updateLocationOrderingEnabled,
} from "@/lib/admin/location-language-actions";
import { MENU_LOCALES } from "@/lib/i18n/locale-config";
import { LOCALE_LABELS, type MenuLocale } from "@/lib/i18n/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function LocationSettings({
  locationName,
  menuLocale: initialMenuLocale,
  googleReviewUrl: initialGoogleReviewUrl,
  orderingEnabled: initialOrderingEnabled,
  canEdit,
}: {
  locationName: string;
  menuLocale: MenuLocale;
  googleReviewUrl: string | null;
  orderingEnabled: boolean;
  canEdit: boolean;
}) {
  const [menuLocale, setMenuLocale] = useState<MenuLocale>(initialMenuLocale);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(
    initialGoogleReviewUrl ?? ""
  );
  const [orderingEnabled, setOrderingEnabled] = useState(initialOrderingEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    const [localeResult, reviewResult, orderingResult] = await Promise.all([
      updateLocationMenuLocale(menuLocale),
      updateLocationGoogleReviewUrl(googleReviewUrl),
      updateLocationOrderingEnabled(orderingEnabled),
    ]);

    setSaving(false);

    if (localeResult?.error) {
      toast.error(localeResult.error);
      return;
    }
    if (reviewResult?.error) {
      toast.error(reviewResult.error);
      return;
    }
    if (orderingResult?.error) {
      toast.error(orderingResult.error);
      return;
    }

    toast.success("Location settings saved");
  }

  return (
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Location settings</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Configuration for{" "}
        <span className="font-medium text-neutral-700">{locationName}</span>.
      </p>

      <div className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-neutral-200 p-4">
        <div className="space-y-1">
          <Label htmlFor="online-ordering">Online ordering</Label>
          <p className="text-xs text-neutral-500">
            When off, guests browse menu but cannot place orders
          </p>
        </div>
        <Switch
          id="online-ordering"
          checked={orderingEnabled}
          onCheckedChange={setOrderingEnabled}
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="menu-locale">Primary language</Label>
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
          Enter product names in {LOCALE_LABELS[menuLocale]} in the primary field,
          and the English translation in the English field.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Label htmlFor="google-review-url">Google Review URL</Label>
        <Input
          id="google-review-url"
          type="url"
          value={googleReviewUrl}
          onChange={(e) => setGoogleReviewUrl(e.target.value)}
          placeholder="https://g.page/r/..."
          disabled={!canEdit}
        />
        <p className="text-xs text-neutral-500">
          Guests see review prompt after payment
        </p>
      </div>

      {canEdit && (
        <Button
          type="button"
          className="mt-6"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      )}
    </div>
  );
}
