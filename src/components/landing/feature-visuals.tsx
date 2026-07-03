"use client";

import { motion } from "framer-motion";
import { Bell, ChefHat, Check, CreditCard, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardOrderVisual() {
  return (
    <div className="rounded-xl border border-[#e3e7ee] bg-white p-5 shadow-[0_18px_52px_-32px_rgba(31,35,40,0.28)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-lg font-bold text-[#1f2328]">#047</p>
          <span className="mt-1 inline-block rounded-full bg-[#eef1f5] px-2.5 py-0.5 text-xs font-medium text-[#596273]">
            Table 8
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <Bell className="size-3" />
          Pickup
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#edf1f5] pt-4">
        {[
          ["Bar", "Ready 4m", "text-emerald-700 bg-emerald-50"],
          ["Kitchen", "In prep", "text-sky-700 bg-sky-50"],
          ["Waiter", "Needed", "text-orange-700 bg-orange-50"],
        ].map(([label, value, style]) => (
          <div key={label} className="rounded-lg border border-[#e7ebf0] p-2.5">
            <p className="text-[10px] font-medium text-[#6b7280]">{label}</p>
            <p className={cn("mt-1 rounded-md px-2 py-1 text-[11px] font-semibold", style)}>
              {value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#596273]">
        Denis spots the stuck handoff before the guest has to ask.
      </p>
    </div>
  );
}

const PAYMENT_METHODS = [
  { name: "stripe", className: "text-[#635bff]" },
  { name: "Apple Pay", className: "text-[#1f2328] text-xs" },
  { name: "G Pay", className: "text-[#1f2328] text-xs" },
  { name: "DATEV", className: "text-emerald-700" },
];

export function PaymentsVisual() {
  const amounts = ["€42.10", "€44.80", "€47.50", "€45.20", "€47.50"];

  return (
    <div className="rounded-xl border border-[#e3e7ee] bg-white p-5 shadow-[0_18px_52px_-32px_rgba(31,35,40,0.28)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1f2328]">Payments</p>
          <p className="text-xs text-[#6b7280]">Stripe ready · signed receipt</p>
        </div>
        <CreditCard className="size-4 text-[#6b7280]" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {PAYMENT_METHODS.map((m) => (
          <span
            key={m.name}
            className={`rounded-full border border-[#e3e7ee] bg-[#fbfcfd] px-3 py-2 text-sm font-semibold ${m.className}`}
          >
            {m.name}
          </span>
        ))}
      </div>
      <div className="flex justify-center overflow-hidden">
        <motion.div
          animate={{ y: [0, -120, -240] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.5, 1],
          }}
          className="flex flex-col items-center gap-4"
        >
          {amounts.map((amt) => (
            <span
              key={amt}
              className="font-mono text-3xl font-bold text-[#1f2328]"
            >
              {amt}
            </span>
          ))}
        </motion.div>
      </div>
      <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        Online paid · no cash handoff
      </div>
    </div>
  );
}

const KITCHEN_CARDS = [
  {
    table: "T8",
    items: "2× Spritz",
    timer: "3m",
    color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    glow: "",
  },
  {
    table: "VIP",
    items: "Nachos",
    timer: "7m",
    color: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    glow: "",
  },
  {
    table: "Bar",
    items: "1× Negroni",
    timer: "11m",
    color: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    glow: "",
  },
  {
    table: "T3",
    items: "3× Beer",
    timer: "14m",
    color: "bg-red-50 text-red-700 ring-1 ring-red-200",
    glow: "",
  },
];

export function KitchenVisual() {
  return (
    <div className="rounded-xl border border-[#e3e7ee] bg-white p-4 shadow-[0_18px_52px_-32px_rgba(31,35,40,0.28)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="size-4 text-[#6b7280]" />
          <p className="text-sm font-semibold text-[#1f2328]">Station watch</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {KITCHEN_CARDS.map((card) => (
          <div
            key={card.table}
            className="rounded-lg border border-[#e7ebf0] bg-[#fbfcfd] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#1f2328]">{card.table}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${card.color} ${card.glow}`}
              >
                {card.timer}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#596273]">{card.items}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PHONE_PRODUCTS = [
  {
    name: "Aperol Spritz",
    price: "€9.50",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    name: "Negroni",
    price: "€12.00",
    gradient: "from-rose-700 to-red-900",
  },
  {
    name: "Espresso Martini",
    price: "€13.00",
    gradient: "from-amber-900 to-stone-800",
  },
  {
    name: "Hugo Spritz",
    price: "€10.00",
    gradient: "from-emerald-500 to-teal-700",
  },
];

export function PhoneMenuVisual({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto h-[560px] w-[280px] rounded-[40px] border-[6px] border-[#e5e9ef] bg-[#f7f9fb] p-2 shadow-[0_22px_60px_-30px_rgba(31,35,40,0.35)]",
        className
      )}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#f7f9fb]" />
      <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-[#fbfcfd] px-3 pb-3 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1f2328]">Skyline Lounge</p>
            <p className="text-[10px] text-[#6b7280]">Table 8</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            <UtensilsCrossed className="size-2.5" />
            Open
          </span>
        </div>

        <div className="mt-3 flex gap-1.5">
          {["Cocktails", "Wine", "Beer"].map((cat, i) => (
            <span
              key={cat}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                i === 0
                  ? "bg-[#1f2328] text-white"
                  : "bg-white text-[#6b7280] ring-1 ring-[#e7ebf0]"
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[10px] font-semibold text-[#6b7280]">
          Cocktails
        </p>

        <div className="mt-2 grid flex-1 grid-cols-2 gap-2 content-start">
          {PHONE_PRODUCTS.map((p) => (
            <div
              key={p.name}
              className="flex flex-col overflow-hidden rounded-lg border border-[#e3e7ee] bg-white"
            >
              <div
                className={`flex h-16 items-center justify-center bg-gradient-to-br ${p.gradient}`}
              >
                <span className="text-xl font-bold text-white/20">
                  {p.name.charAt(0)}
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-[10px] font-medium text-[#1f2328]">
                  {p.name}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[#1f2328]">
                    {p.price}
                  </span>
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#1f2328] text-[10px] font-bold text-white">
                    +
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeatureCheck({
  children,
  light,
  accent,
}: {
  children: React.ReactNode;
  light?: boolean;
  accent?: boolean;
}) {
  const onDark = accent && !light;
  return (
    <li
      className={cn(
        "flex items-start gap-2 text-sm",
        onDark ? "text-zinc-300" : light ? "text-zinc-600" : "text-zinc-400"
      )}
    >
      <Check
        className={cn(
          "mt-0.5 size-4 shrink-0",
          accent
            ? "text-[var(--lp-accent,#818cf8)]"
            : light
              ? "text-zinc-500"
              : "text-zinc-500"
        )}
        strokeWidth={1.75}
      />
      {children}
    </li>
  );
}
