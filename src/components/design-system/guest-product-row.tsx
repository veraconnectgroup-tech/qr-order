"use client";

import { Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GuestProductRowProps = {
  name: string;
  /** Guest-language translation shown under the venue name. */
  nameSecondary?: string | null;
  price: number;
  currency: string;
  /** Description, AI reason, or other secondary line. */
  subtitle?: string | null;
  /** Guest-language description shown under the venue description. */
  subtitleSecondary?: string | null;
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
  /** Opens product detail without nesting add control inside a second interactive. */
  onOpenDetail?: () => void;
  openDetailAriaLabel?: string;
  meta?: React.ReactNode;
  className?: string;
};

/**
 * DE-04 — shared guest product row (menu list + Denis recommendations).
 * @see docs/design/ADR-008-web-design-architecture.md §5.6
 */
export function GuestProductRow({
  name,
  nameSecondary,
  price,
  currency,
  subtitle,
  subtitleSecondary,
  density = "default",
  disabled = false,
  added = false,
  addAriaLabel,
  addLabel = "Add",
  addedLabel = "Added",
  addStyle = "text",
  onAdd,
  onOpenDetail,
  openDetailAriaLabel,
  meta,
  className,
}: GuestProductRowProps) {
  const showAdd = !disabled && !added && onAdd;
  const nameClass =
    density === "menu"
      ? "text-[15px] font-medium"
      : "text-[15px] font-medium";

  const nameBlock = (
    <div className="min-w-0">
      {density === "menu" && !onOpenDetail ? (
        <h3 className={cn(nameClass, "text-[var(--qr-ivory)]")}>{name}</h3>
      ) : (
        <p className={cn(nameClass, "text-[var(--qr-ivory)]")}>{name}</p>
      )}
      {nameSecondary ? (
        <p className="mt-0.5 text-sm text-[var(--qr-muted)]">{nameSecondary}</p>
      ) : null}
    </div>
  );

  const namePriceRow = (
    <div className="flex items-baseline justify-between gap-4">
      {nameBlock}
      <span
        className={cn(
          "shrink-0 tabular-nums text-[var(--qr-ivory)]",
          density === "menu" ? "text-[15px]" : "text-sm"
        )}
      >
        {formatPrice(price, currency)}
      </span>
    </div>
  );

  const detailBody = (
    <>
      {namePriceRow}
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
      {subtitleSecondary ? (
        <p
          className={cn(
            "mt-1 text-[var(--qr-muted)]/80",
            density === "menu"
              ? "max-w-[32rem] text-sm leading-relaxed italic"
              : "text-sm italic"
          )}
        >
          {subtitleSecondary}
        </p>
      ) : null}
      {meta}
    </>
  );

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
      {onOpenDetail ? (
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={openDetailAriaLabel ?? `View ${name} details`}
          className="min-w-0 flex-1 cursor-pointer text-left transition active:opacity-70"
        >
          {detailBody}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{detailBody}</div>
      )}

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
