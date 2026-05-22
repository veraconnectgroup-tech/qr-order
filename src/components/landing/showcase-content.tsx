"use client";

import { useState } from "react";
import {
  getOrderColumnId,
  ORDER_COLUMNS,
  OrderCard,
} from "@/components/dashboard/order-card";
import { CategoryPills } from "@/components/guest/category-pills";
import { GuestHeader } from "@/components/guest/guest-header";
import { MenuGrid } from "@/components/guest/menu-grid";
import {
  DEMO_CART_ITEMS,
  DEMO_CURRENCY,
  DEMO_MENU_CATEGORIES,
  DEMO_ORDERS,
} from "@/components/landing/demo-data";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

const noop = () => {};

const CART_TOTAL = DEMO_CART_ITEMS.reduce((sum, item) => sum + item.itemTotal, 0);
const CART_COUNT = DEMO_CART_ITEMS.reduce((sum, item) => sum + item.quantity, 0);

const STATUS_BADGE: Record<string, string> = {
  new: "bg-orange-500/15 text-orange-400",
  preparing: "bg-yellow-500/15 text-yellow-400",
  ready: "bg-green-500/15 text-green-400",
  delivered: "bg-zinc-700/50 text-zinc-400",
};

function trimOrderItems(order: OrderWithDetails, maxItems = 3): OrderWithDetails {
  return {
    ...order,
    order_items: order.order_items?.slice(0, maxItems) ?? [],
  };
}

/** Guest menu UI — reusable in phone frame or hero layer */
export function GuestMenuContent({ variant = "feature" }: { variant?: "feature" | "hero" }) {
  const [activeCategory, setActiveCategory] = useState(
    DEMO_MENU_CATEGORIES[0]?.id ?? ""
  );
  const pillCategories = DEMO_MENU_CATEGORIES.map(({ id, name }) => ({ id, name }));
  const isHero = variant === "hero";
  const heroProducts = DEMO_MENU_CATEGORIES.find(
    (c) => c.id === activeCategory
  )?.products.slice(0, 2);

  if (isHero) {
    return (
      <div className="pointer-events-none relative flex h-[560px] w-[300px] flex-col bg-[#09090b]">
        <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              S
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-zinc-100">
                Skyline Lounge
              </p>
              <p className="truncate text-[10px] text-zinc-500">Rooftop · Hamburg</p>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              Table 8
            </span>
          </div>
        </header>

        <div className="flex shrink-0 gap-1.5 overflow-hidden px-3 py-2">
          {pillCategories.map((cat) => (
            <span
              key={cat.id}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium",
                activeCategory === cat.id
                  ? "bg-orange-500 text-white"
                  : "bg-zinc-800 text-zinc-400"
              )}
            >
              {cat.name}
            </span>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-[52px]">
          <p className="mb-2 text-[11px] font-semibold text-zinc-300">
            Cocktails{" "}
            <span className="font-normal text-zinc-500">({heroProducts?.length ?? 0})</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {heroProducts?.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
              >
                <div className="relative flex h-[72px] items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <span className="text-xl font-bold text-zinc-700">
                    {product.name.charAt(0)}
                  </span>
                  {product.prep_time_minutes != null && product.prep_time_minutes > 0 && (
                    <span className="absolute right-1 top-1 rounded-full bg-zinc-950/80 px-1 py-0.5 text-[8px] text-zinc-400">
                      {product.prep_time_minutes}m
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] font-medium leading-tight text-zinc-100">
                    {product.name}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-orange-500">
                      {formatPrice(Number(product.price), DEMO_CURRENCY)}
                    </span>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                      <span className="text-sm leading-none">+</span>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-orange-500 px-3 py-2.5 text-white">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium">
              {CART_COUNT} {CART_COUNT === 1 ? "item" : "items"}
            </span>
            <span className="font-semibold">Cart →</span>
            <span className="font-bold tabular-nums">
              {formatPrice(CART_TOTAL, DEMO_CURRENCY)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none relative flex flex-col bg-[#09090b]",
        "h-[min(520px,72dvh)] sm:h-[580px]"
      )}
    >
      <GuestHeader
        orgName="Skyline Lounge"
        subtitle="Rooftop · Hamburg"
        tableName="Table 8"
      />
      <CategoryPills
        categories={pillCategories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />
      <div
        className={cn(
          "flex-1 overflow-hidden px-2 pb-14 pt-1 sm:px-3",
          "[&_article_div:first-child]:h-[80px] sm:[&_article_div:first-child]:h-[96px]",
          "[&_h2]:text-sm [&_h3]:text-[11px] [&_img]:hidden",
          "[&_.grid]:grid-cols-2 [&_.grid]:gap-2"
        )}
      >
        <MenuGrid
          categories={DEMO_MENU_CATEGORIES.filter(
            (c) => c.id === activeCategory
          )}
          currency={DEMO_CURRENCY}
          onOpenDetail={() => {}}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 rounded-t-xl bg-orange-500 px-2.5 py-2.5 text-white shadow-2xl sm:rounded-t-2xl sm:px-3 sm:py-3">
        <div className="flex items-center justify-between gap-1 text-[10px] sm:text-xs">
          <span className="font-medium">
            {CART_COUNT} {CART_COUNT === 1 ? "item" : "items"}
          </span>
          <span className="font-semibold">Cart →</span>
          <span className="font-bold tabular-nums">
            {formatPrice(CART_TOTAL, DEMO_CURRENCY)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Orders board — hero (2 cols) or feature (full) */
export function OrdersBoardContent({
  variant = "feature",
}: {
  variant?: "hero" | "feature";
}) {
  const isHero = variant === "hero";
  const columns = isHero
    ? ORDER_COLUMNS.filter((c) => ["new", "preparing", "ready"].includes(c.id))
    : ORDER_COLUMNS;

  if (isHero) {
    return (
      <div className="pointer-events-none select-none p-3 [&_article]:p-3 [&_button]:py-1.5 [&_button]:text-xs [&_li]:text-xs [&_p.font-mono.text-lg]:text-base">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
          <p className="text-xs font-semibold text-zinc-200">Live Orders</p>
          <span className="text-[10px] text-emerald-400">● Live</span>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {columns.map((column) => {
            const order = DEMO_ORDERS.find((o) =>
              column.statuses.includes(o.status)
            );
            if (!order) return null;
            return (
              <div
                key={column.id}
                className={cn(
                  "min-w-0 flex-1 rounded-lg border-t-2 bg-zinc-900/50 p-2",
                  column.border
                )}
              >
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                  {column.label}
                </p>
                <OrderCard
                  order={trimOrderItems(order, 2)}
                  currency={DEMO_CURRENCY}
                  busy={false}
                  interactive={false}
                  onAccept={noop}
                  onReject={noop}
                  onStartPreparing={noop}
                  onMarkReady={noop}
                  onMarkDelivered={noop}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-3 sm:px-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-xs">
            Operations
          </p>
          <p className="text-sm font-semibold text-zinc-100 sm:text-base">
            Live Orders
          </p>
        </div>
        <p className="text-[10px] text-zinc-500 sm:text-xs">
          Skyline Lounge ·{" "}
          <span className="font-medium text-emerald-400">● Live</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 p-3 md:hidden">
        {columns.flatMap((column) => {
          const colOrders = DEMO_ORDERS.filter((o) =>
            column.statuses.includes(o.status)
          );
          return colOrders.map((order) => (
            <div key={order.id}>
              <span
                className={cn(
                  "mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  STATUS_BADGE[getOrderColumnId(order.status)] ??
                    STATUS_BADGE.delivered
                )}
              >
                {column.label}
              </span>
              <OrderCard
                order={trimOrderItems(order, 2)}
                currency={DEMO_CURRENCY}
                busy={false}
                interactive={false}
                onAccept={noop}
                onReject={noop}
                onStartPreparing={noop}
                onMarkReady={noop}
                onMarkDelivered={noop}
              />
            </div>
          ));
        })}
      </div>

      <div className="hidden gap-3 overflow-x-auto p-4 pt-0 md:flex md:pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {columns.map((column) => {
          const colOrders = DEMO_ORDERS.filter((o) =>
            column.statuses.includes(o.status)
          );
          return (
            <div
              key={column.id}
              className={cn(
                "flex w-[min(240px,38vw)] shrink-0 flex-col rounded-xl bg-zinc-900/40 p-2.5",
                "border-t-2 lg:w-[220px]",
                column.border
              )}
            >
              <div className="mb-2.5 flex items-center justify-between px-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {column.label}
                </h3>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    column.badge
                  )}
                >
                  {colOrders.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={trimOrderItems(order, 3)}
                    currency={DEMO_CURRENCY}
                    busy={false}
                    interactive={false}
                    onAccept={noop}
                    onReject={noop}
                    onStartPreparing={noop}
                    onMarkReady={noop}
                    onMarkDelivered={noop}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
