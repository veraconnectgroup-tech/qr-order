"use client";

import { ShowcaseKitchenCard } from "@/components/landing/showcase-static/showcase-kitchen-card";
import { DEMO_KITCHEN_ORDERS } from "@/components/landing/demo-data";
import { ShowcaseTablet } from "@/components/landing/showcase-frame";
import { cn } from "@/lib/utils";

export function KitchenShowcase() {
  return (
    <ShowcaseTablet
      url="denis.app/kitchen"
      hideCaption
      theme="light"
    >
      <div className="pointer-events-none select-none bg-white">
        <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900">Skyline Lounge</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 sm:text-xs sm:tracking-[0.2em]">
              Prep Display
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:px-2.5 sm:text-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Live
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-zinc-500 sm:text-xs">
            <span>
              Active:{" "}
              <span className="font-semibold text-zinc-800">
                {DEMO_KITCHEN_ORDERS.length}
              </span>
            </span>
            <span>
              Preparing: <span className="font-semibold text-zinc-800">1</span>
            </span>
          </div>
        </div>
        <div
          className={cn(
            "grid grid-cols-1 gap-3 bg-zinc-50/50 p-3 sm:grid-cols-2 sm:p-4",
            "[&_span.rounded-lg]:px-3 [&_span.rounded-lg]:py-1.5 [&_span.rounded-lg]:text-xs [&_li]:text-sm [&_p.text-2xl]:text-xl"
          )}
        >
          {DEMO_KITCHEN_ORDERS.map((order) => (
            <ShowcaseKitchenCard
              key={order.id}
              order={order}
              appearance="light"
            />
          ))}
        </div>
      </div>
    </ShowcaseTablet>
  );
}
