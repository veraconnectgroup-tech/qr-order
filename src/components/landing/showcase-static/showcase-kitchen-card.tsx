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
        "rounded-xl border-2 p-4",
        light ? "bg-white" : "bg-zinc-900",
        isAccepted ? "border-orange-500" : "border-blue-500"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-2xl font-bold",
            light ? "text-zinc-900" : "text-zinc-100"
          )}
        >
          {formatOrderNumber(order.order_number)}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              light ? "bg-zinc-100 text-zinc-600" : "bg-zinc-800 text-zinc-400"
            )}
          >
            {tableName}
          </span>
          <span className="text-sm text-green-400">
            {formatTimeAgo(order.created_at)}
          </span>
        </div>
      </div>

      <div
        className={cn("my-3 border-t", light ? "border-zinc-200" : "border-zinc-800")}
      />

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn("text-sm", light ? "text-zinc-800" : "text-zinc-200")}
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
        className={cn("my-3 border-t", light ? "border-zinc-200" : "border-zinc-800")}
      />

      <div className="flex flex-wrap items-center gap-2">
        {isAccepted ? (
          <span className="rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white">
            Start Preparing
          </span>
        ) : (
          <span className="rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white">
            Ready
          </span>
        )}
        <span className="px-3 text-sm text-red-400">Reject</span>
      </div>
    </article>
  );
}
