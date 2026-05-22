"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardOrderVisual() {
  return (
    <div className="rounded-xl border border-zinc-800 border-l-2 border-l-orange-500 bg-zinc-950 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-lg font-bold text-zinc-50">#047</p>
          <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
            Table 8
          </span>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          Ready
        </span>
      </div>
      <ul className="mt-4 space-y-2 border-t border-zinc-800 pt-4 text-sm text-zinc-300">
        <li>2× Aperol Spritz</li>
        <li>1× Hugo Spritz</li>
        <li>1× Espresso Martini</li>
        <li>2× Truffle Fries</li>
      </ul>
    </div>
  );
}

const PAYMENT_METHODS = [
  { name: "Stripe", className: "text-violet-400" },
  { name: "Apple Pay", className: "text-zinc-100 text-xs" },
  { name: "Google Pay", className: "text-zinc-100 text-xs" },
  { name: "Visa", className: "text-blue-400 italic" },
  { name: "MC", className: "text-orange-400" },
];

export function PaymentsVisual() {
  const amounts = ["€42.10", "€44.80", "€47.50", "€45.20", "€47.50"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-4">
        {PAYMENT_METHODS.map((m) => (
          <span
            key={m.name}
            className={`rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold ${m.className}`}
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
              className="font-mono text-3xl font-bold text-orange-500"
            >
              {amt}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

const KITCHEN_CARDS = [
  {
    table: "T8",
    items: "2× Spritz",
    timer: "3m",
    color: "bg-emerald-500/20 text-emerald-400",
    glow: "",
  },
  {
    table: "VIP",
    items: "Nachos",
    timer: "7m",
    color: "bg-yellow-500/20 text-yellow-400",
    glow: "",
  },
  {
    table: "Bar",
    items: "1× Negroni",
    timer: "11m",
    color: "bg-yellow-500/20 text-yellow-400",
    glow: "",
  },
  {
    table: "T3",
    items: "3× Beer",
    timer: "14m",
    color: "bg-red-500/20 text-red-400",
    glow: "shadow-[0_0_12px] shadow-red-500/30",
  },
];

export function KitchenVisual() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {KITCHEN_CARDS.map((card) => (
        <div
          key={card.table}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-zinc-50">{card.table}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${card.color} ${card.glow}`}
            >
              {card.timer}
            </span>
          </div>
          <p className="mt-2.5 text-sm text-zinc-400">{card.items}</p>
        </div>
      ))}
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
        "relative mx-auto h-[560px] w-[280px] rounded-[40px] border-2 border-zinc-600 bg-zinc-950 p-2 shadow-xl shadow-black/40",
        className
      )}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-zinc-950" />
      <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-[#09090b] px-3 pb-3 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-50">Skyline Lounge</p>
            <p className="text-[10px] text-zinc-500">Table 8</p>
          </div>
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-500">
            Live
          </span>
        </div>

        <div className="mt-3 flex gap-1.5">
          {["Cocktails", "Wine", "Beer"].map((cat, i) => (
            <span
              key={cat}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                i === 0
                  ? "bg-orange-500 text-white"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[10px] font-bold tracking-wider text-zinc-500">
          COCKTAILS
        </p>

        <div className="mt-2 grid flex-1 grid-cols-2 gap-2 content-start">
          {PHONE_PRODUCTS.map((p) => (
            <div
              key={p.name}
              className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            >
              <div
                className={`flex h-16 items-center justify-center bg-gradient-to-br ${p.gradient}`}
              >
                <span className="text-xl font-bold text-white/20">
                  {p.name.charAt(0)}
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-[10px] font-medium text-zinc-200">
                  {p.name}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-orange-500">
                    {p.price}
                  </span>
                  <span className="flex size-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
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

export function FeatureCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-zinc-400">
      <Check className="mt-0.5 size-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
      {children}
    </li>
  );
}
