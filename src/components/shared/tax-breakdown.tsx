import { formatPrice } from "@/lib/format";
import { taxBreakdownFromOrderItems } from "@/lib/tax/vat";
import { cn } from "@/lib/utils";

export function TaxBreakdownLines({
  items,
  currency,
  className,
  labelPrefix = "MwSt",
}: {
  items: Array<{ total: number; tax_rate: number }>;
  currency: string;
  className?: string;
  labelPrefix?: string;
}) {
  const breakdown = taxBreakdownFromOrderItems(items);
  if (breakdown.length === 0) return null;

  return (
    <div className={cn("space-y-0.5", className)}>
      {breakdown.map((line) => (
        <div
          key={line.rate}
          className="flex justify-between text-xs tabular-nums text-zinc-500"
        >
          <span>
            {labelPrefix} {line.rate}%
          </span>
          <span>{formatPrice(line.amount, currency)}</span>
        </div>
      ))}
    </div>
  );
}
