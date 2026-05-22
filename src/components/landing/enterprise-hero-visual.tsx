"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DEMO_CURRENCY, DEMO_ORDERS } from "@/components/landing/demo-data";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import {
  HeroFloat,
  HeroGlow,
  HeroSlideIn,
} from "@/components/landing/hero-motion";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import {
  ShowcasePhone,
  ShowcaseStage,
  ShowcaseWindow,
} from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

function HeroLiveOrderCard() {
  const order = DEMO_ORDERS[0];
  const itemCount =
    order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/95 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <motion.span
          className="size-2 rounded-full bg-emerald-500/80"
          animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
          transition={
            reduce
              ? undefined
              : { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <span className="text-[11px] font-semibold text-zinc-200">
          Live order
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-500">
          #{order.order_number}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-medium text-zinc-100">
          {order.tables?.name ?? "Table 8"}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {itemCount} items · {formatPrice(order.total, DEMO_CURRENCY)}
        </p>
        <span className="mt-2 text-[10px] font-medium text-zinc-400">
          Preparing · ~8 min
        </span>
      </div>
    </div>
  );
}

function HeroPhoneStack() {
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-1/2 size-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-[120px]" />
      </div>
      <ShowcasePhone hideLabel className="max-w-none">
        <ScaledPhonePreview designHeight={560}>
          <GuestMenuContent variant="hero" />
        </ScaledPhonePreview>
      </ShowcasePhone>
      <HeroSlideIn
        from="bottom"
        delay={0.35}
        className="absolute -bottom-3 left-1/2 z-10 w-[88%] -translate-x-1/2"
      >
        <HeroLiveOrderCard />
      </HeroSlideIn>
    </div>
  );
}

export function EnterpriseHeroVisual() {
  const reduce = useReducedMotion();

  return (
    <>
      <motion.div
        className="flex justify-center pb-6 md:hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <HeroPhoneStack />
      </motion.div>

      <ShowcaseStage className="hidden md:block lg:max-w-[840px]">
        <HeroGlow className="left-[18%] top-[24%] size-[300px]" />
        <HeroGlow className="right-[8%] bottom-[18%] size-[220px] bg-white/[0.03]" />

        <HeroSlideIn
          from="right"
          delay={0.08}
          className="absolute right-[-2%] top-0 z-10 w-[88%] lg:w-[86%]"
        >
          <ShowcaseWindow
            url="app.qr-order.com/orders"
            className="shadow-[0_28px_90px_-20px_rgba(0,0,0,0.85)]"
          >
            <DashboardScreenShowcase screen="orders" variant="hero" />
          </ShowcaseWindow>
        </HeroSlideIn>

        <HeroFloat
          delay={0.32}
          className="absolute bottom-[4%] left-[-2%] z-30 w-[34%] min-w-[168px] max-w-[228px]"
        >
          <ShowcasePhone
            hideLabel
            className="max-w-none shadow-[0_20px_56px_rgba(0,0,0,0.7)]"
          >
            <ScaledPhonePreview designHeight={560}>
              <GuestMenuContent variant="hero" />
            </ScaledPhonePreview>
          </ShowcasePhone>
        </HeroFloat>

        <HeroSlideIn
          from="bottom"
          delay={0.52}
          className="absolute bottom-[10%] right-[2%] z-20 w-[40%] max-w-[210px]"
        >
          <HeroLiveOrderCard />
        </HeroSlideIn>

        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-2xl border border-zinc-800/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 1 }}
          />
        )}
      </ShowcaseStage>
    </>
  );
}
