import { FloorTile } from "./floor-tile";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type DenisChipProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function DenisChip({
  label,
  onClick,
  disabled = false,
  selected = false,
  className,
  style,
}: DenisChipProps) {
  return (
    <FloorTile
      as="button"
      variant="chip"
      label={label}
      onClick={onClick}
      disabled={disabled}
      status={selected ? "selected" : "available"}
      className={cn("shrink-0 touch-target", className)}
      style={style}
    />
  );
}
