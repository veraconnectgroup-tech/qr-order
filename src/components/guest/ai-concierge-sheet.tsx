"use client";

import { useState } from "react";
import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
  type AiSheetAllergyId,
  type AiSheetMoodId,
  type AiSheetSelections,
} from "@/lib/ai/guest-sheet-preferences";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AiConciergeSheet({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (selections: AiSheetSelections) => void;
}) {
  const [allergies, setAllergies] = useState<AiSheetAllergyId[]>([]);
  const [mood, setMood] = useState<AiSheetMoodId | null>(null);

  function toggleAllergy(id: AiSheetAllergyId) {
    if (id === "keine") {
      setAllergies(["keine"]);
      return;
    }

    setAllergies((prev) => {
      const withoutKeine = prev.filter((item) => item !== "keine");
      if (withoutKeine.includes(id)) {
        return withoutKeine.filter((item) => item !== id);
      }
      return [...withoutKeine, id];
    });
  }

  function handleComplete() {
    onComplete({ allergies, mood });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[40dvh] snap-start rounded-t-2xl border-zinc-800 bg-zinc-950 px-4 pb-safe text-zinc-100"
      >
        <SheetHeader className="px-0 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-700" />
          <SheetTitle className="text-left text-base font-semibold text-zinc-100">
            Haben Sie Allergien?
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {AI_SHEET_ALLERGY_OPTIONS.map((option) => {
            const selected = allergies.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleAllergy(option.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  selected
                    ? "border-orange-500 bg-orange-500/20 text-orange-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-sm font-semibold text-zinc-200">
          Worauf haben Sie Lust?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AI_SHEET_MOOD_OPTIONS.map((option) => {
            const selected = mood === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setMood(selected ? null : option.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  selected
                    ? "border-orange-500 bg-orange-500/20 text-orange-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <SheetFooter className="px-0 pb-2">
          <button
            type="button"
            onClick={handleComplete}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-[0.98]"
          >
            Fertig
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
