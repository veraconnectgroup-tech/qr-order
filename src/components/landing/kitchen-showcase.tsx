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
        <div className="border-b border-[#e7ebf0] bg-[#fbfcfd] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1f2328]">
              Kitchen station
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-normal text-[#6b7280] sm:text-xs">
              Skyline Lounge
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:px-2.5 sm:text-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Live
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-[#6b7280] sm:text-xs">
            <span>
              Active:{" "}
              <span className="font-semibold text-[#1f2328]">
                {DEMO_KITCHEN_ORDERS.length}
              </span>
            </span>
            <span>
              Ready pickup: <span className="font-semibold text-[#1f2328]">1</span>
            </span>
            <span>
              Denis watching: <span className="font-semibold text-[#1f2328]">on</span>
            </span>
          </div>
        </div>
        <div
          className={cn(
            "grid grid-cols-1 gap-3 bg-[#fbfcfd] p-3 sm:grid-cols-2 sm:p-4",
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
