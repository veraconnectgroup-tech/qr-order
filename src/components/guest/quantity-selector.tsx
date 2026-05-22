"use client";

import { Minus, Plus } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

export function QuantitySelector({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 rounded-full border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
        onClick={() => {
          hapticLight();
          onChange(Math.max(min, value - 1));
        }}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </Button>
      <span className="text-xl font-bold tabular-nums text-white">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 rounded-full border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
        onClick={() => {
          hapticLight();
          onChange(value + 1);
        }}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
