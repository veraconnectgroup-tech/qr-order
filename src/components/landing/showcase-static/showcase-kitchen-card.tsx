import { formatOrderNumber } from "@/lib/format";
import { demoElapsedMinutes } from "@/components/landing/demo-data";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

function formatTimeAgo(iso: string) {
  const minutes = demoElapsedMinutes(iso);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

/** Static kitchen card for landing previews — no Supabase or hooks. */
export function ShowcaseKitchenCard({
  order,
  appearance = "default",
}: {
  order: OrderWithDetails;
  appearance?: "default" | "light";
}) {
  const light = appearance === "light";
  const tableName = order.tables?.name ?? "—";
  const isAccepted = order.status === "accepted";
  const items = order.order_items ?? [];

  return (
    <article
      className={cn(
        "rounded-xl border p-3.5",
        light ? "bg-white" : "bg-zinc-900",
        isAccepted
          ? light
            ? "border-l-2 border-[#e3e7ee] border-l-[#e85d04]"
            : "border-orange-500"
          : light
            ? "border-l-2 border-[#e3e7ee] border-l-sky-500"
            : "border-blue-500"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "font-mono text-xl font-bold",
            light ? "text-zinc-900" : "text-zinc-100"
          )}
        >
          {formatOrderNumber(order.order_number)}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              light ? "bg-[#eef1f5] text-[#596273]" : "bg-zinc-800 text-zinc-400"
            )}
          >
            {tableName}
          </span>
          <span className="text-xs font-medium text-emerald-600">
            {formatTimeAgo(order.created_at)}
          </span>
        </div>
      </div>

      <div
        className={cn("my-3 border-t", light ? "border-[#edf1f5]" : "border-zinc-800")}
      />

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn("text-[13px]", light ? "text-zinc-800" : "text-zinc-200")}
          >
            <span className="font-semibold">{item.quantity}×</span>{" "}
            {item.product_name}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p
          className={cn(
            "mt-3 border-l-2 border-amber-500 pl-3 text-sm italic",
            light ? "text-amber-700" : "text-amber-400"
          )}
        >
          {order.notes}
        </p>
      )}

      <div
        className={cn("my-3 border-t", light ? "border-[#edf1f5]" : "border-zinc-800")}
      />

      <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
        <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
          Bar ready
        </span>
        <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">
          Kitchen {isAccepted ? "queued" : "active"}
        </span>
        <span className="rounded-md bg-orange-50 px-2 py-1 font-semibold text-orange-700">
          Waiter hold
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAccepted ? (
          <span className="rounded-md bg-[#1f2328] px-3 py-1.5 text-xs font-semibold text-white">
            Start Preparing
          </span>
        ) : (
          <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            Ready
          </span>
        )}
        <span className="px-2 text-xs font-medium text-[#6b7280]">
          Ask Denis
        </span>
      </div>
    </article>
  );
}
