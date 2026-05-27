"use client";

import { Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GuestProductRowProps = {
  name: string;
  price: number;
  currency: string;
  /** Description, AI reason, or other secondary line. */
  subtitle?: string | null;
  /** Menu list uses larger spacing; Denis recommendations use compact. */
  density?: "menu" | "default" | "compact";
  disabled?: boolean;
  added?: boolean;
  addAriaLabel?: string;
  addLabel?: string;
  addedLabel?: string;
  /** Icon-only add control (Denis compact) vs text label. */
  addStyle?: "icon" | "text";
  onAdd?: () => void;
  meta?: React.ReactNode;
  className?: string;
};

/**
 * DE-04 — shared guest product row (menu list + Denis recommendations).
 * @see docs/design/ADR-008-web-design-architecture.md §5.6
 */
export function GuestProductRow({
  name,
  price,
  currency,
  subtitle,
  density = "default",
  disabled = false,
  added = false,
  addAriaLabel,
  addLabel = "Add",
  addedLabel = "Added",
  addStyle = "text",
  onAdd,
  meta,
  className,
}: GuestProductRowProps) {
  const showAdd = !disabled && !added && onAdd;
  const nameClass =
    density === "menu"
      ? "text-[15px] font-medium"
      : "text-[15px] font-medium";

  return (
    <div
      className={cn(
        "flex items-start justify-between",
        density === "menu" && "gap-6 py-5",
        density === "default" && "gap-4 py-3",
        density === "compact" && "gap-4 py-2.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          {density === "menu" ? (
            <h3 className={cn(nameClass, "text-[var(--qr-ivory)]")}>{name}</h3>
          ) : (
            <p className={cn(nameClass, "text-[var(--qr-ivory)]")}>{name}</p>
          )}
          <span
            className={cn(
              "shrink-0 tabular-nums text-[var(--qr-ivory)]",
              density === "menu" ? "text-[15px]" : "text-sm"
            )}
          >
            {formatPrice(price, currency)}
          </span>
        </div>
        {subtitle ? (
          <p
            className={cn(
              "mt-1 text-[var(--qr-muted)]",
              density === "menu"
                ? "max-w-[32rem] text-sm leading-relaxed"
                : "text-sm"
            )}
          >
            {subtitle}
          </p>
        ) : null}
        {meta}
      </div>

      {showAdd ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={cn(
            "shrink-0 text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)] touch-manipulation",
            addStyle === "icon" &&
              "mt-0.5 flex size-9 items-center justify-center",
            addStyle === "text" && "text-xs"
          )}
          aria-label={addAriaLabel ?? `Add ${name}`}
        >
          {addStyle === "icon" ? (
            <Plus className="size-5" strokeWidth={1.5} />
          ) : (
            addLabel
          )}
        </button>
      ) : null}

      {added ? (
        <span className="shrink-0 text-xs text-[var(--qr-muted)]">
          {addedLabel}
        </span>
      ) : null}
    </div>
  );
}
