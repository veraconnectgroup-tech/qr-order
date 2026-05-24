"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import type { MenuSection } from "@/lib/menu-section";
import { cn } from "@/lib/utils";
import type { Modifier, ModifierGroup, ProductWithModifiers } from "@/types";
import type { StaffCartItem } from "@/components/dashboard/staff-order-entry";

function groupFailsMinSelect(
  group: ModifierGroup,
  selectedIds: string[]
) {
  const min = Math.max(group.is_required ? 1 : 0, group.min_select ?? 0);
  return selectedIds.length < min;
}

export function StaffOrderModifierDialog({
  product,
  menuSection,
  currency,
  open,
  onOpenChange,
  onAdd,
}: {
  product: ProductWithModifiers | null;
  menuSection: MenuSection;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: Omit<StaffCartItem, "id" | "lineTotal">) => void;
}) {
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const groups = useMemo(
    () =>
      (product?.modifier_groups ?? [])
        .map((group) => ({
          ...group,
          modifiers: group.modifiers.filter((modifier) => modifier.is_available),
        }))
        .filter((group) => group.modifiers.length > 0),
    [product]
  );

  const selectedModifiers = useMemo(() => {
    const result: Array<{
      modifierId: string;
      modifierName: string;
      price: number;
    }> = [];

    for (const group of groups) {
      for (const modId of selected[group.id] ?? []) {
        const mod = group.modifiers.find((entry) => entry.id === modId);
        if (mod) {
          result.push({
            modifierId: mod.id,
            modifierName: mod.name,
            price: Number(mod.price),
          });
        }
      }
    }

    return result;
  }, [groups, selected]);

  const invalidSelection = groups.some((group) =>
    groupFailsMinSelect(group, selected[group.id] ?? [])
  );

  function resetForm() {
    setNotes("");
    setSelected({});
  }

  function close() {
    resetForm();
    onOpenChange(false);
  }

  function toggleModifier(group: ModifierGroup, modifier: Modifier) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.max_select === 1) {
        return { ...prev, [group.id]: [modifier.id] };
      }
      if (current.includes(modifier.id)) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== modifier.id),
        };
      }
      if (current.length >= group.max_select) return prev;
      return { ...prev, [group.id]: [...current, modifier.id] };
    });
  }

  function handleAdd() {
    if (!product || invalidSelection) return;

    onAdd({
      productId: product.id,
      productName: product.name,
      unitPrice: Number(product.price),
      quantity: 1,
      notes: notes.trim(),
      modifiers: selectedModifiers,
      menuSection,
      productTaxRate:
        product.tax_rate != null ? Number(product.tax_rate) : null,
    });
    resetForm();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resetForm();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={close}
      />

      <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-dash-border bg-dash-bg p-5 text-dash-text shadow-xl">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-dash-text">{product.name}</h2>
          <p className="mt-1 font-semibold text-dash-accent">
            {formatPrice(Number(product.price), currency)}
          </p>
        </div>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-dash-text-secondary">
                  {group.name}
                </p>
                {group.is_required && (
                  <span className="text-xs font-medium text-red-400">
                    *required
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {group.modifiers.map((modifier) => {
                  const isSelected = (selected[group.id] ?? []).includes(
                    modifier.id
                  );
                  return (
                    <button
                      key={modifier.id}
                      type="button"
                      onClick={() => toggleModifier(group, modifier)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition",
                        isSelected
                          ? "border-dash-accent bg-dash-accent-muted text-dash-accent"
                          : "border-dash-border bg-dash-surface-raised text-dash-text-secondary hover:border-dash-surface-overlay"
                      )}
                    >
                      <span>{modifier.name}</span>
                      {Number(modifier.price) > 0 && (
                        <span className="text-dash-text-muted">
                          +{formatPrice(Number(modifier.price), currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label
              htmlFor="staff-item-notes"
              className="mb-2 block text-sm font-semibold text-dash-text-secondary"
            >
              Item notes
            </label>
            <Input
              id="staff-item-notes"
              value={notes}
              maxLength={200}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. no onions"
              className="border-dash-surface-overlay bg-dash-surface text-dash-text placeholder:text-dash-text-disabled"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-dash-surface-overlay bg-transparent text-dash-text-secondary hover:bg-dash-surface"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={invalidSelection}
            className="flex-1 bg-dash-accent text-white hover:bg-dash-accent-hover"
            onClick={handleAdd}
          >
            Add to order
          </Button>
        </div>
      </div>
    </div>
  );
}
