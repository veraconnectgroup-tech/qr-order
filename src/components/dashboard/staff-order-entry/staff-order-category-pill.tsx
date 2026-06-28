"use client";

import { cn } from "@/lib/utils";

export function StaffOrderCategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-dash-accent text-white"
          : "bg-dash-surface-raised text-dash-text-secondary hover:bg-dash-surface-overlay"
      )}
    >
      {label}
    </button>
  );
}
