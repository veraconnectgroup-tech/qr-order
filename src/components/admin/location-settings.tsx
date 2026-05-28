"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  updateLocationGoogleReviewUrl,
  updateLocationMenuLocale,
  updateLocationOrderingEnabled,
  updateLocationRequireFirstTableApproval,
} from "@/lib/admin/location-language-actions";
import { updateLocationAiConciergeEnabled } from "@/lib/admin/ai-actions";
import { MENU_LOCALES } from "@/lib/i18n/locale-config";
import { LOCALE_LABELS, type MenuLocale } from "@/lib/i18n/translations";
import { AdminPanel, AdminPanelSection } from "@/components/admin/admin-panel";
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
  requireFirstTableApproval: initialRequireFirstTableApproval,
  aiConciergeEnabled: initialAiConciergeEnabled,
  canEdit,
}: {
  locationName: string;
  menuLocale: MenuLocale;
  googleReviewUrl: string | null;
  orderingEnabled: boolean;
  requireFirstTableApproval: boolean;
  aiConciergeEnabled: boolean;
  canEdit: boolean;
}) {
  const [menuLocale, setMenuLocale] = useState<MenuLocale>(initialMenuLocale);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(
    initialGoogleReviewUrl ?? ""
  );
  const [orderingEnabled, setOrderingEnabled] = useState(initialOrderingEnabled);
  const [requireFirstTableApproval, setRequireFirstTableApproval] = useState(
    initialRequireFirstTableApproval
  );
  const [aiConciergeEnabled, setAiConciergeEnabled] = useState(
    initialAiConciergeEnabled
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    const [localeResult, reviewResult, orderingResult, approvalResult, aiResult] =
      await Promise.all([
        updateLocationMenuLocale(menuLocale),
        updateLocationGoogleReviewUrl(googleReviewUrl),
        updateLocationOrderingEnabled(orderingEnabled),
        updateLocationRequireFirstTableApproval(requireFirstTableApproval),
        updateLocationAiConciergeEnabled(aiConciergeEnabled),
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
    if (approvalResult?.error) {
      toast.error(approvalResult.error);
      return;
    }
    if (aiResult?.error) {
      toast.error(aiResult.error);
      return;
    }

    toast.success("Location settings saved");
  }

  return (
    <AdminPanel
      title="Location settings"
      description={
        <>
          Configuration for{" "}
          <span className="font-medium text-foreground">{locationName}</span>.
        </>
      }
    >
      <AdminPanelSection className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="online-ordering">Online ordering</Label>
          <p className="text-xs text-muted-foreground">
            When off, guests browse menu but cannot place orders
          </p>
        </div>
        <Switch
          id="online-ordering"
          checked={orderingEnabled}
          onCheckedChange={setOrderingEnabled}
          disabled={!canEdit}
        />
      </AdminPanelSection>

      <AdminPanelSection className="mt-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="first-table-approval">First table confirmation</Label>
          <p className="text-xs text-muted-foreground">
            When on, staff must approve the first order at an empty table. When
            off, the table session opens automatically on the first order.
          </p>
        </div>
        <Switch
          id="first-table-approval"
          checked={requireFirstTableApproval}
          onCheckedChange={setRequireFirstTableApproval}
          disabled={!canEdit}
        />
      </AdminPanelSection>

      <AdminPanelSection className="mt-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="ai-concierge">Denis aktivieren</Label>
          <p className="text-xs text-muted-foreground">
            Gäste erhalten Denis-Empfehlungen im Menü
          </p>
        </div>
        <Switch
          id="ai-concierge"
          checked={aiConciergeEnabled}
          onCheckedChange={setAiConciergeEnabled}
          disabled={!canEdit}
        />
      </AdminPanelSection>

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
        <p className="text-xs text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">
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
    </AdminPanel>
  );
}
