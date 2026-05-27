import { formatOrderNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getShowcaseOrderColumnId } from "@/components/landing/showcase-static/order-columns";
import type { OrderWithDetails } from "@/types";

type CardAppearance = "default" | "light" | "cinematic";

/** Static order card for landing previews — no dashboard deps. */
export function ShowcaseOrderCard({
  order,
  currency,
  appearance = "default",
}: {
  order: OrderWithDetails;
  currency: string;
  appearance?: CardAppearance;
}) {
  const light = appearance === "light";
  const cinematic = appearance === "cinematic";
  const columnId = getShowcaseOrderColumnId(order.status);
  const tableName = order.tables?.name ?? "—";
  const items = order.order_items ?? [];

  if (cinematic) {
    const item = items[0];
    return (
      <article className="max-w-[280px]">
        <p className="font-mono text-[4rem] font-medium leading-[0.9] tracking-[-0.06em] text-zinc-100 sm:text-[4.25rem]">
          {formatOrderNumber(order.order_number)}
        </p>
        {item && (
          <p className="mt-[5.5rem] text-[14px] leading-[1.6] tracking-[-0.01em] text-zinc-700">
            {item.product_name}
          </p>
        )}
      </article>
    );
  }

  if (columnId === "delivered") {
    return (
      <article
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border p-2.5 opacity-60",
          light ? "border-zinc-200 bg-white" : "border-zinc-800 bg-zinc-900"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span
            className={cn(
              "shrink-0 font-mono font-semibold tabular-nums",
              light ? "text-zinc-900" : "text-zinc-50"
            )}
          >
            {formatOrderNumber(order.order_number)}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
              light ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300"
            )}
          >
            {tableName}
          </span>
          <span className="ml-auto shrink-0 font-mono font-semibold tabular-nums text-orange-500">
            {formatPrice(Number(order.total), currency)}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl border p-4",
        light
          ? "border-zinc-200 bg-white"
          : "border-zinc-800 bg-zinc-900",
        columnId === "new" && "border-l-2 border-l-orange-500"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "font-mono text-lg font-bold",
            light ? "text-zinc-900" : "text-zinc-50"
          )}
        >
          {formatOrderNumber(order.order_number)}
        </p>
      </div>

      <div className="mt-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            light ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-200"
          )}
        >
          {tableName}
        </span>
      </div>

      <ul
        className={cn(
          "mt-3 space-y-1 text-sm",
          light ? "text-zinc-700" : "text-zinc-300"
        )}
      >
        {items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.product_name}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "my-3 border-t",
          light ? "border-zinc-200" : "border-zinc-800"
        )}
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-base font-semibold text-orange-500">
          {formatPrice(Number(order.total), currency)}
        </span>
      </div>

      {columnId === "new" && (
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white">
            Accept
          </span>
          <span className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400">
            Reject
          </span>
        </div>
      )}
      {columnId === "preparing" && (
        <span className="mt-3 inline-block rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-zinc-950">
          Mark ready
        </span>
      )}
      {columnId === "ready" && (
        <span className="mt-3 inline-block rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white">
          Delivered
        </span>
      )}
    </article>
  );
}
