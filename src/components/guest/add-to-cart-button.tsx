"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { hapticClick } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

export function AddToCartButton({
  label,
  disabled,
  onAdd,
}: {
  label: string;
  disabled?: boolean;
  onAdd: () => void;
}) {
  const [added, setAdded] = useState(false);

  function handleClick() {
    if (disabled || added) return;
    hapticClick();
    onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 800);
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || added}
      className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600 disabled:bg-zinc-700"
    >
      {added ? (
        <Check className="size-5" />
      ) : (
        label
      )}
    </Button>
  );
}
