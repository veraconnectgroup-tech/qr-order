"use client";

import { useState } from "react";
import { formatServeSize } from "@/lib/serve-size";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function ServeSizeSelector({
  presets,
  allowCustom,
  value,
  onChange,
}: {
  presets: string[];
  allowCustom: boolean;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [customMode, setCustomMode] = useState(
    () => Boolean(value && !presets.includes(value))
  );
  const [customValue, setCustomValue] = useState(
    () => (value && !presets.includes(value) ? value : "")
  );

  function selectPreset(preset: string) {
    setCustomMode(false);
    setCustomValue("");
    onChange(preset);
  }

  function enableCustom() {
    setCustomMode(true);
    onChange(customValue || null);
  }

  function updateCustom(next: string) {
    const cleaned = next.replace(/[^\d.,]/g, "");
    setCustomValue(cleaned);
    onChange(cleaned || null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const selected = !customMode && value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => selectPreset(preset)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                selected
                  ? "bg-orange-500 text-white"
                  : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
              )}
            >
              {formatServeSize(preset)}
            </button>
          );
        })}
        {allowCustom && (
          <button
            type="button"
            onClick={enableCustom}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              customMode
                ? "bg-orange-500 text-white"
                : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
            )}
          >
            Custom
          </button>
        )}
      </div>

      {customMode && allowCustom && (
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="e.g. 0.25"
            value={customValue}
            onChange={(e) => updateCustom(e.target.value)}
            className="border-zinc-700 bg-zinc-950 text-zinc-100"
          />
          <span className="shrink-0 text-sm text-zinc-500">liters</span>
        </div>
      )}
    </div>
  );
}
