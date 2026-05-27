"use client";

import { useState } from "react";
import {
  DEMO_CART_ITEMS,
  DEMO_CURRENCY,
  DEMO_MENU_CATEGORIES,
  DEMO_ORDERS,
  demoElapsedMinutes,
} from "@/components/landing/demo-data";
import {
  getShowcaseOrderColumnId,
  SHOWCASE_ORDER_COLUMNS,
} from "@/components/landing/showcase-static/order-columns";
import { ShowcaseOrderCard } from "@/components/landing/showcase-static/showcase-order-card";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ShowcaseTheme } from "@/components/landing/showcase-frame";
import type { OrderWithDetails } from "@/types";

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

/** Static guest menu UI for landing previews — no guest app deps. */
export function GuestMenuContent({
  variant = "hero",
}: {
  variant?: "feature" | "hero" | "cinematic";
}) {
  const [activeCategory, setActiveCategory] = useState(
    DEMO_MENU_CATEGORIES[0]?.id ?? ""
  );
  const pillCategories = DEMO_MENU_CATEGORIES.map(({ id, name }) => ({ id, name }));
  const isHero = variant === "hero";
  const isCinematic = variant === "cinematic";
  const activeProducts = DEMO_MENU_CATEGORIES.find(
    (c) => c.id === activeCategory
  )?.products.slice(0, isCinematic ? 2 : isHero ? 2 : 4);

  if (isCinematic) {
    const products = activeProducts?.slice(0, 2) ?? [];
    const cartPreviewTotal = products.reduce(
      (sum, product) => sum + Number(product.price),
      0
    );

    return (
      <div className="pointer-events-none flex h-full min-h-[440px] w-full flex-col bg-[#0a0a0a]">
        <header className="shrink-0 border-b border-zinc-800/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold leading-tight tracking-[-0.02em] text-zinc-100">
                Skyline Lounge
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">Table 8 · Rooftop</p>
            </div>
            <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-800">
              Drinks
            </span>
          </div>
        </header>

        <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-xl bg-zinc-950/90 px-3.5 py-2.5 ring-1 ring-zinc-800/80">
          <span
            className="size-1.5 shrink-0 rounded-full bg-emerald-500 pulse-dot"
            aria-hidden
          />
          <p className="text-[11px] leading-snug text-zinc-400">
            <span className="font-mono text-zinc-300">#047</span> syncing with floor
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 px-4 py-5">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3.5 rounded-xl bg-zinc-950/90 p-3.5 ring-1 ring-zinc-800/70"
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm font-semibold text-zinc-600">
                    {product.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-snug tracking-[-0.01em] text-zinc-100">
                  {product.name}
                </p>
                {product.prep_time_minutes != null && (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {product.prep_time_minutes} min prep
                  </p>
                )}
              </div>
              <p className="font-mono text-[13px] tabular-nums text-zinc-300">
                {formatPrice(Number(product.price), DEMO_CURRENCY)}
              </p>
            </div>
          ))}
        </div>

        <footer className="shrink-0 border-t border-zinc-800/70 px-4 py-4">
          <div className="flex items-center justify-between rounded-xl bg-[#e85d04] px-4 py-3 text-white">
            <span className="text-[11px] font-medium">
              {products.length} {products.length === 1 ? "item" : "items"}
            </span>
            <span className="text-[12px] font-semibold tracking-wide">Cart →</span>
            <span className="font-mono text-[13px] font-bold tabular-nums">
              {formatPrice(cartPreviewTotal, DEMO_CURRENCY)}
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none relative flex w-full flex-col bg-[#09090b]",
        isHero ? "h-full min-h-[480px]" : "h-[min(520px,72dvh)] sm:h-[580px]"
      )}
    >
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-[var(--lp-accent)] ring-1 ring-zinc-700">
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
          <button
            key={cat.id}
            type="button"
            tabIndex={-1}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium",
              activeCategory === cat.id
                ? "bg-zinc-800 text-zinc-100 ring-1 ring-[var(--lp-accent)]/40"
                : "bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className={cn("min-h-0 flex-1 overflow-hidden px-3", isHero ? "pb-[52px]" : "pb-14 pt-1")}>
        <p className="mb-2 text-[11px] font-semibold text-zinc-300">
          {pillCategories.find((c) => c.id === activeCategory)?.name}{" "}
          <span className="font-normal text-zinc-500">
            ({activeProducts?.length ?? 0})
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {activeProducts?.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            >
              <div className="relative h-[72px] overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 sm:h-[80px]">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <span className="text-xl font-bold text-zinc-700">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                )}
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
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {formatPrice(Number(product.price), DEMO_CURRENCY)}
                  </span>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[var(--lp-accent)] ring-1 ring-zinc-700">
                    <span className="text-sm leading-none">+</span>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2.5 backdrop-blur-sm",
          !isHero && "rounded-t-xl bg-orange-500 text-white shadow-2xl sm:rounded-t-2xl sm:px-3 sm:py-3"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 text-[11px]",
            !isHero && "text-[10px] sm:text-xs"
          )}
        >
          <span className={cn("font-medium", isHero ? "text-zinc-400" : "font-medium")}>
            {CART_COUNT} {CART_COUNT === 1 ? "item" : "items"}
          </span>
          <span className="font-semibold">Cart →</span>
          <span
            className={cn(
              "font-bold tabular-nums",
              isHero ? "text-[var(--lp-accent)]" : "font-bold"
            )}
          >
            {formatPrice(CART_TOTAL, DEMO_CURRENCY)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Static orders board for landing previews — no dashboard deps. */
export function OrdersBoardContent({
  variant = "feature",
  theme = "dark",
}: {
  variant?: "hero" | "feature" | "cinematic";
  theme?: ShowcaseTheme;
}) {
  const isHero = variant === "hero";
  const isCinematic = variant === "cinematic";
  const light = theme === "light";
  const cardAppearance = light ? "light" : "default";
  const columns = isHero || isCinematic
    ? SHOWCASE_ORDER_COLUMNS.filter((c) => ["new", "preparing", "ready"].includes(c.id))
    : SHOWCASE_ORDER_COLUMNS;

  if (isCinematic) {
    const primaryOrder = DEMO_ORDERS.find((o) => o.status === "pending");
    const preparingOrder = DEMO_ORDERS.find((o) => o.status === "preparing");
    const readyOrder = DEMO_ORDERS.find((o) => o.status === "ready");

    if (!primaryOrder) return null;

    const preparingMinutes = preparingOrder?.created_at
      ? demoElapsedMinutes(preparingOrder.created_at)
      : null;

    return (
      <div className="pointer-events-none select-none">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">
              Operations
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">
              Live Orders
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            Skyline Lounge
            <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
            <span className="font-medium text-emerald-500/90">Live</span>
          </p>
        </div>

        <p className="mb-5 flex items-center gap-2 text-[11px] text-zinc-600">
          <span className="size-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
          Synced across floor · bar · kitchen
        </p>

        <div className="flex items-start gap-5 lg:gap-8">
          <ShowcaseOrderCard
            order={trimOrderItems(primaryOrder, 2)}
            currency={DEMO_CURRENCY}
            appearance="cinematic"
          />
          {preparingOrder && (
            <div className="hidden min-w-[150px] flex-1 pt-8 opacity-[0.55] sm:block">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-yellow-500/90">
                <span
                  className="size-1.5 rounded-full bg-yellow-500 pulse-dot"
                  aria-hidden
                />
                Preparing
              </p>
              <p className="font-mono text-xl font-medium text-zinc-300">
                {formatOrderNumber(preparingOrder.order_number)}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-zinc-500">
                {preparingOrder.tables?.name ?? "Bar"} ·{" "}
                {preparingOrder.order_items?.[0]?.product_name}
              </p>
              {preparingMinutes != null && (
                <p className="mt-1.5 text-[10px] text-zinc-600">{preparingMinutes}m in prep</p>
              )}
            </div>
          )}
          {readyOrder && (
            <div className="hidden min-w-[120px] flex-1 pt-12 opacity-[0.34] lg:block">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-500/90">
                <span
                  className="size-1.5 rounded-full bg-green-500 pulse-dot"
                  aria-hidden
                />
                Ready
              </p>
              <p className="font-mono text-lg font-medium text-zinc-400">
                {formatOrderNumber(readyOrder.order_number)}
              </p>
              <p className="mt-2 text-[11px] text-zinc-600">
                {readyOrder.tables?.name} · awaiting pickup
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isHero) {
    return (
      <div className="pointer-events-none select-none p-3 [&_article]:p-3 [&_button]:py-1.5 [&_button]:text-xs [&_li]:text-xs [&_p.font-mono.text-lg]:text-base">
        <div
          className={cn(
            "mb-2 flex items-center justify-between gap-2 border-b pb-2",
            light ? "border-zinc-200" : "border-zinc-800"
          )}
        >
          <p className={cn("text-xs font-semibold", light ? "text-zinc-800" : "text-zinc-200")}>
            Live Orders
          </p>
          <span className="text-[10px] text-emerald-500">● Live</span>
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
                  "min-w-0 flex-1 rounded-lg border-t-2 p-2",
                  column.border,
                  light ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-900/50"
                )}
              >
                <p
                  className={cn(
                    "mb-1.5 text-[9px] font-bold uppercase tracking-wide",
                    light ? "text-zinc-500" : "text-zinc-500"
                  )}
                >
                  {column.label}
                </p>
                <ShowcaseOrderCard
                  order={trimOrderItems(order, 2)}
                  currency={DEMO_CURRENCY}
                  appearance={cardAppearance}
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
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3 sm:px-4",
          light ? "border-zinc-200 bg-white" : "border-zinc-800"
        )}
      >
        <div>
          <p
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider sm:text-xs",
              light ? "text-zinc-500" : "text-zinc-500"
            )}
          >
            Operations
          </p>
          <p
            className={cn(
              "text-sm font-semibold sm:text-base",
              light ? "text-zinc-900" : "text-zinc-100"
            )}
          >
            Live Orders
          </p>
        </div>
        <p className="text-[10px] text-zinc-500 sm:text-xs">
          Skyline Lounge ·{" "}
          <span className="font-medium text-emerald-500">● Live</span>
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
                  STATUS_BADGE[getShowcaseOrderColumnId(order.status)] ??
                    STATUS_BADGE.delivered
                )}
              >
                {column.label}
              </span>
              <ShowcaseOrderCard
                order={trimOrderItems(order, 2)}
                currency={DEMO_CURRENCY}
                appearance={cardAppearance}
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
                "flex w-[min(240px,38vw)] shrink-0 flex-col rounded-xl p-2.5",
                "border-t-2 lg:w-[220px]",
                column.border,
                light ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-900/40"
              )}
            >
              <div className="mb-2.5 flex items-center justify-between px-0.5">
                <h3
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    light ? "text-zinc-600" : "text-zinc-300"
                  )}
                >
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
                  <ShowcaseOrderCard
                    key={order.id}
                    order={trimOrderItems(order, 3)}
                    currency={DEMO_CURRENCY}
                    appearance={cardAppearance}
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
