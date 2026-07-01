"use client";

import { useState } from "react";
import {
  EU_ALLERGENS,
  normalizeAllergenId,
  type AllergenId,
} from "@/lib/allergens";
import { DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ProductImageUpload } from "@/components/dashboard/product-image-upload";
import type { MenuEditorProductFormValues } from "@/components/dashboard/menu-editor/types";
import {
  DEFAULT_SERVE_SIZE_PRESETS,
  parseServeSizePresets,
} from "@/lib/serve-size";
import type { MenuSection } from "@/lib/menu-section";
import { LOCALE_LABELS, type MenuLocale } from "@/lib/i18n/translations";
import type { Product } from "@/types";

export function MenuEditorProductForm({
  initial,
  currency,
  orgId,
  menuLocale,
  categoryMenuSection,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: Partial<Product>;
  currency: string;
  orgId: string;
  menuLocale: MenuLocale;
  categoryMenuSection: MenuSection;
  onSubmit: (values: MenuEditorProductFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nameEn, setNameEn] = useState(initial?.name_en ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    initial?.description_en ?? ""
  );
  const [aiDescription, setAiDescription] = useState(
    initial?.ai_description ?? ""
  );
  const [price, setPrice] = useState(
    initial?.price != null ? String(initial.price) : ""
  );
  const [prepTime, setPrepTime] = useState(
    initial?.prep_time_minutes != null
      ? String(initial.prep_time_minutes)
      : ""
  );
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.image_url ?? null
  );
  const [allergens, setAllergens] = useState<Set<AllergenId>>(() => {
    const ids = new Set<AllergenId>();
    for (const raw of initial?.allergens ?? []) {
      const id = normalizeAllergenId(raw);
      if (id) ids.add(id);
    }
    return ids;
  });
  const [requiresServeSize, setRequiresServeSize] = useState(
    initial?.requires_serve_size ?? false
  );
  const [serveSizePresetsText, setServeSizePresetsText] = useState(
    initial?.serve_size_presets?.join(", ") ??
      DEFAULT_SERVE_SIZE_PRESETS.join(", ")
  );
  const [allowCustomServeSize, setAllowCustomServeSize] = useState(
    initial?.allow_custom_serve_size ?? true
  );
  const isDrinksCategory = categoryMenuSection === "drinks";
  const initialTaxSetting =
    initial?.tax_rate == null
      ? "default"
      : Number(initial.tax_rate) === 7
        ? "7"
        : "19";
  const [taxSetting, setTaxSetting] = useState<"default" | "7" | "19">(
    isDrinksCategory ? "19" : initialTaxSetting
  );

  const taxRateValue: number | null =
    taxSetting === "default" ? null : taxSetting === "7" ? 7 : 19;
  const primaryLang = LOCALE_LABELS[menuLocale];

  return (
    <div className="space-y-4 py-2">
      <ProductImageUpload
        orgId={orgId}
        value={imageUrl}
        onChange={setImageUrl}
        disabled={saving}
      />

      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">Name ({primaryLang})</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">Name (English)</span>
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="Aperol Spritz"
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">
          Ingredients ({primaryLang}, comma-separated)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Prosecco, Aperol, soda, orange slice"
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">
          Ingredients (English, optional)
        </span>
        <textarea
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          rows={2}
          placeholder="Prosecco, Aperol, soda, orange slice"
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">AI Beschreibung</span>
        <textarea
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          rows={3}
          placeholder="Beschreiben Sie Zubereitung, Zutaten, Empfehlungen für Denis"
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <div className="space-y-2">
        <span className="text-sm text-dash-text-muted">Allergens (EU 14)</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EU_ALLERGENS.map((allergen) => {
            const checked = allergens.has(allergen.id);
            return (
              <label
                key={allergen.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dash-border bg-dash-bg/50 px-3 py-2 text-sm text-dash-text-secondary"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setAllergens((prev) => {
                      const next = new Set(prev);
                      if (next.has(allergen.id)) next.delete(allergen.id);
                      else next.add(allergen.id);
                      return next;
                    });
                  }}
                  className="size-4 rounded border-dash-surface-overlay"
                />
                <span aria-hidden>{allergen.emoji}</span>
                <span>{allergen.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">Price ({currency})</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">Prep time (minutes)</span>
        <input
          type="number"
          min="1"
          value={prepTime}
          onChange={(e) => setPrepTime(e.target.value)}
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-dash-text-muted">MwSt-Satz</span>
        <select
          value={isDrinksCategory ? "19" : taxSetting}
          onChange={(e) =>
            setTaxSetting(e.target.value as "default" | "7" | "19")
          }
          disabled={isDrinksCategory}
          className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="default">Org default (19%)</option>
          <option value="7">Ermäßigt (7%)</option>
          <option value="19">Standard (19%)</option>
        </select>
        {isDrinksCategory && (
          <p className="text-xs text-dash-text-disabled">
            Drinks are always taxed at 19%.
          </p>
        )}
      </label>
      <label className="flex items-center gap-2 text-sm text-dash-text-secondary">
        <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
        Available on guest menu
      </label>

      <div className="space-y-3 rounded-lg border border-dash-border bg-dash-bg/50 p-4">
        <label className="flex items-center gap-2 text-sm text-dash-text-secondary">
          <Switch
            checked={requiresServeSize}
            onCheckedChange={setRequiresServeSize}
          />
          Ask for serve size (drinks)
        </label>
        {requiresServeSize && (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm text-dash-text-muted">
                Preset sizes in liters (comma-separated)
              </span>
              <input
                value={serveSizePresetsText}
                onChange={(e) => setServeSizePresetsText(e.target.value)}
                placeholder="0.2, 0.3, 0.5"
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-dash-text-secondary">
              <Switch
                checked={allowCustomServeSize}
                onCheckedChange={setAllowCustomServeSize}
              />
              Allow custom size entry
            </label>
          </>
        )}
      </div>

      <DialogFooter className="border-dash-border bg-transparent pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-dash-text-muted hover:text-dash-text-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !name.trim() || !price}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              name_en: nameEn.trim(),
              description: description.trim(),
              description_en: descriptionEn.trim(),
              price: Number(price),
              prep_time_minutes: prepTime ? Number(prepTime) : null,
              is_available: isAvailable,
              image_url: imageUrl,
              allergens: allergens.size > 0 ? [...allergens] : null,
              requires_serve_size: requiresServeSize,
              serve_size_presets: requiresServeSize
                ? parseServeSizePresets(serveSizePresetsText)
                : null,
              allow_custom_serve_size: allowCustomServeSize,
              tax_rate: taxRateValue,
              ai_description: aiDescription.trim(),
            })
          }
          className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </DialogFooter>
    </div>
  );
}
