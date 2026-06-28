"use client";

import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, ImageIcon, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMenuCsv } from "@/lib/menu-import/parse-menu-csv";
import type { MenuImportItem } from "@/lib/menu-import/types";
import {
  extractOnboardingMenuFromText,
  saveOnboardingMenuImport,
} from "@/lib/dashboard/onboarding-actions";
import { toast } from "sonner";

type Category = { id: string; name: string; menu_section: string };

type ImportMode = "csv" | "ocr" | "manual";

export function OnboardingMenuImport({
  categories,
  currency,
  initialItems,
  onSaved,
}: {
  categories: Category[];
  currency: string;
  initialItems: MenuImportItem[];
  onSaved: (count: number) => void;
}) {
  const [mode, setMode] = useState<ImportMode>("csv");
  const [items, setItems] = useState<MenuImportItem[]>(initialItems);
  const [ocrText, setOcrText] = useState("");
  const [pending, startTransition] = useTransition();

  const categoryOptions = useMemo(
    () => categories.map((cat) => cat.name),
    [categories]
  );

  function applyParsed(nextItems: MenuImportItem[], warnings: string[] = []) {
    setItems(nextItems);
    warnings.forEach((warning) => toast.message(warning));
    if (nextItems.length) {
      toast.success(`Extracted ${nextItems.length} items — review and confirm.`);
    }
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseMenuCsv(text, categories);
      applyParsed(parsed.items, parsed.warnings);
    };
    reader.readAsText(file);
  }

  function runOcrExtract() {
    startTransition(async () => {
      const result = await extractOnboardingMenuFromText(ocrText);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("items" in result) {
        applyParsed(result.items, result.warnings ?? []);
      }
    });
  }

  function updateItem(index: number, patch: Partial<MenuImportItem>) {
    setItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  function addManualRow() {
    setItems((rows) => [
      ...rows,
      {
        name: "",
        price: 0,
        category: categories[0]?.name ?? "Food",
        description: null,
      },
    ]);
  }

  function confirmSave() {
    const valid = items.filter((item) => item.name.trim() && item.price > 0);
    if (!valid.length) {
      toast.error("Add at least one product.");
      return;
    }
    startTransition(async () => {
      const result = await saveOnboardingMenuImport(valid);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      onSaved("count" in result ? (result.count ?? valid.length) : valid.length);
      toast.success(`Saved ${valid.length} menu items.`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["csv", "CSV / Excel", FileSpreadsheet],
            ["ocr", "Photo OCR", ImageIcon],
            ["manual", "Manual", PenLine],
          ] as const
        ).map(([key, label, Icon]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={mode === key ? "default" : "outline"}
            onClick={() => setMode(key)}
            className={
              mode === key
                ? "bg-dash-accent hover:bg-dash-accent-hover"
                : "border-dash-surface-overlay"
            }
          >
            <Icon className="me-2 size-4" />
            {label}
          </Button>
        ))}
      </div>

      {mode === "csv" && (
        <div className="rounded-xl border border-dash-border bg-dash-surface/60 p-4">
          <Label htmlFor="csv-upload">Upload CSV</Label>
          <Input
            id="csv-upload"
            type="file"
            accept=".csv,.txt,text/csv"
            className="mt-2 border-dash-surface-overlay bg-dash-surface"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleCsvFile(file);
            }}
          />
          <p className="mt-2 text-xs text-dash-text-disabled">
            Columns: name, description, price, category, allergens
          </p>
        </div>
      )}

      {mode === "ocr" && (
        <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface/60 p-4">
          <div>
            <Label htmlFor="ocr-text">Paste OCR text from menu photo</Label>
            <textarea
              id="ocr-text"
              value={ocrText}
              onChange={(event) => setOcrText(event.target.value)}
              rows={6}
              placeholder={"Vorspeisen\nBruschetta 8.50\n...\nGetränke\nPilsner 4.90"}
              className="mt-2 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 py-2 text-sm text-dash-text"
            />
          </div>
          <Button
            type="button"
            onClick={runOcrExtract}
            disabled={pending || !ocrText.trim()}
            className="bg-dash-accent hover:bg-dash-accent-hover"
          >
            Extract items
          </Button>
        </div>
      )}

      {mode === "manual" && (
        <Button
          type="button"
          variant="outline"
          onClick={addManualRow}
          className="border-dash-surface-overlay"
        >
          + Add product
        </Button>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-dash-text-secondary">
            Review & confirm ({items.length})
          </p>
          {items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="grid gap-3 rounded-xl border border-dash-border bg-dash-surface/60 p-4 sm:grid-cols-[1fr_100px_120px_32px]"
            >
              <div>
                <Label>Name</Label>
                <Input
                  value={item.name}
                  onChange={(event) =>
                    updateItem(index, { name: event.target.value })
                  }
                  className="mt-1 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
              <div>
                <Label>Price ({currency})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price || ""}
                  onChange={(event) =>
                    updateItem(index, {
                      price: Number(event.target.value) || 0,
                    })
                  }
                  className="mt-1 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  value={item.category}
                  onChange={(event) =>
                    updateItem(index, { category: event.target.value })
                  }
                  className="mt-1 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
                >
                  {categoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            onClick={confirmSave}
            disabled={pending}
            className="bg-dash-accent hover:bg-dash-accent-hover"
          >
            Confirm & save menu
          </Button>
        </div>
      )}
    </div>
  );
}
