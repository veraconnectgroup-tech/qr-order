import { FloorTile } from "./floor-tile";
import { cn } from "@/lib/utils";

export type DenisChipProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
};

export function DenisChip({
  label,
  onClick,
  disabled = false,
  selected = false,
  className,
}: DenisChipProps) {
  return (
    <FloorTile
      as="button"
      variant="chip"
      label={label}
      onClick={onClick}
      disabled={disabled}
      status={selected ? "selected" : "available"}
      className={cn("shrink-0", className)}
    />
  );
}
