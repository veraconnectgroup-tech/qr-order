"use client";

import { KitchenCard } from "@/components/dashboard/kitchen-board";
import { DEMO_KITCHEN_ORDERS } from "@/components/landing/demo-data";
import { ShowcaseTablet } from "@/components/landing/showcase-frame";

const noop = () => {};

export function KitchenShowcase() {
  return (
    <ShowcaseTablet
      url="dashboard.qrorder.app/kitchen"
      label="Staff tablet — prep display"
      shortLabel="Staff — prep"
    >
      <div className="pointer-events-none select-none">
        <div className="border-b border-zinc-800 bg-zinc-950 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-300">Skyline Lounge</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 sm:text-xs sm:tracking-[0.2em]">
              Prep Display
            </p>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 sm:px-2.5 sm:text-xs">
              ● Live
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-zinc-400 sm:text-xs">
            <span>
              Active:{" "}
              <span className="font-semibold text-zinc-200">
                {DEMO_KITCHEN_ORDERS.length}
              </span>
            </span>
            <span>
              Preparing:{" "}
              <span className="font-semibold text-zinc-200">1</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-xs [&_li]:text-sm [&_p.text-2xl]:text-xl [&_p.text-base]:text-sm">
          {DEMO_KITCHEN_ORDERS.map((order) => (
            <KitchenCard
              key={order.id}
              order={order}
              busy={false}
              onStartPreparing={noop}
              onMarkReady={noop}
              onReject={noop}
            />
          ))}
        </div>
      </div>
    </ShowcaseTablet>
  );
}
