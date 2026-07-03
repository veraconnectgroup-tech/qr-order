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
    return (
      <article className="max-w-[320px] rounded-xl border border-[#e3e7ee] border-l-2 border-l-[#e85d04] bg-white p-5 shadow-[0_18px_52px_-32px_rgba(31,35,40,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[1.75rem] font-semibold leading-none tracking-normal text-[#1f2328]">
            {formatOrderNumber(order.order_number)}
          </p>
          <span className="shrink-0 rounded-md bg-[#eef1f5] px-2 py-0.5 text-[11px] font-medium text-[#596273]">
            {tableName}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-normal text-orange-700">
            Pending
          </span>
          <span className="text-[11px] text-[#8b95a4]">· just now</span>
        </div>

        <ul className="mt-4 space-y-1.5 text-[13px] leading-snug text-[#596273]">
          {items.slice(0, 2).map((line) => (
            <li key={line.id}>
              {line.quantity}× {line.product_name}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-[#edf1f5] pt-4">
          <span className="font-mono text-sm font-semibold tabular-nums text-[#1f2328]">
            {formatPrice(Number(order.total), currency)}
          </span>
          <span className="rounded-lg bg-[#1f2328] px-3.5 py-1.5 text-[11px] font-semibold text-white">
            Accept
          </span>
        </div>
      </article>
    );
  }

  if (columnId === "delivered") {
    return (
      <article
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border p-2.5 opacity-70",
          light ? "border-[#e7ebf0] bg-[#fbfcfd]" : "border-zinc-800 bg-zinc-900"
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
              light ? "bg-[#eef1f5] text-[#596273]" : "bg-zinc-800 text-zinc-300"
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
        "rounded-xl border p-3.5",
        light
          ? "border-[#e3e7ee] bg-white"
          : "border-zinc-800 bg-zinc-900",
        columnId === "new" && "border-l-2 border-l-[#e85d04]",
        light && columnId === "ready" && "border-l-2 border-l-emerald-500",
        light && columnId === "preparing" && "border-l-2 border-l-sky-500"
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
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold",
            columnId === "new" && "bg-orange-50 text-orange-700",
            columnId === "preparing" && "bg-sky-50 text-sky-700",
            columnId === "ready" && "bg-emerald-50 text-emerald-700"
          )}
        >
          {columnId === "new"
            ? "Pending"
            : columnId === "preparing"
              ? "Kitchen"
              : "Ready"}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            light ? "bg-[#eef1f5] text-[#596273]" : "bg-zinc-800 text-zinc-200"
          )}
        >
          {tableName}
        </span>
        {light && (
          <span className="text-[11px] font-medium text-[#6b7280]">
            QR order
          </span>
        )}
      </div>

      <ul
        className={cn(
          "mt-3 space-y-1 text-[13px]",
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
        className={cn("my-3 border-t", light ? "border-[#edf1f5]" : "border-zinc-800")}
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-[#1f2328]">
          {formatPrice(Number(order.total), currency)}
        </span>
        {light && (
          <span className="text-[11px] font-medium text-[#6b7280]">
            Stripe paid
          </span>
        )}
      </div>

      {columnId === "new" && (
        <div className="mt-3 flex gap-2">
          <span className="rounded-md bg-[#1f2328] px-3 py-1.5 text-xs font-semibold text-white">
            Accept
          </span>
          <span className="rounded-md border border-[#d8dee8] px-3 py-1.5 text-xs text-[#596273]">
            Reject
          </span>
        </div>
      )}
      {columnId === "preparing" && (
        <span className="mt-3 inline-block rounded-md bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
          Mark ready
        </span>
      )}
      {columnId === "ready" && (
        <span className="mt-3 inline-block rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          Notify waiter
        </span>
      )}
    </article>
  );
}
