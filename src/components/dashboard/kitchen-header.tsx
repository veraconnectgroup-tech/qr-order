"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { SoundToggle } from "@/components/dashboard/sound-toggle";
import { PushOptIn } from "@/components/dashboard/push-opt-in";
import { LiveConnectionBadge } from "@/components/dashboard/live-connection-badge";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";
import type { OrderWithDetails } from "@/types";

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(
        new Date().toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-3xl tabular-nums text-zinc-100">{time}</span>
  );
}

function avgElapsedMinutes(orders: OrderWithDetails[]) {
  if (!orders.length) return 0;
  const total = orders.reduce((sum, o) => {
    const since = o.preparing_at ?? o.accepted_at ?? o.created_at;
    return sum + (Date.now() - new Date(since).getTime());
  }, 0);
  return Math.round(total / orders.length / 60_000);
}

export function KitchenHeader({
  orders,
  realtimeMode,
}: {
  orders: OrderWithDetails[];
  realtimeMode?: RealtimeMode;
}) {
  const { orgName } = useDashboard();

  const preparingCount = useMemo(
    () => orders.filter((o) => o.status === "preparing").length,
    [orders]
  );

  const avgMin = useMemo(() => avgElapsedMinutes(orders), [orders]);

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950">
      <header className="flex h-14 items-center justify-between px-4">
        <p className="truncate text-sm font-semibold text-zinc-300">{orgName}</p>
        <LiveClock />
        <div className="flex items-center gap-2">
          {realtimeMode && <LiveConnectionBadge mode={realtimeMode} />}
          <Link
            href="/dashboard/kitchen/kds"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <Maximize2 className="size-4" />
            Otvori KDS
          </Link>
          <PushOptIn />
          <SoundToggle />
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <ArrowLeft className="size-4" />
            Exit Prep
          </Link>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
        <span>
          Active:{" "}
          <span className="font-semibold text-zinc-200">{orders.length}</span>
        </span>
        <span className="text-zinc-700">|</span>
        <span>
          Preparing:{" "}
          <span className="font-semibold text-zinc-200">{preparingCount}</span>
        </span>
        <span className="text-zinc-700">|</span>
        <span>
          Avg time:{" "}
          <span className="font-semibold text-zinc-200">{avgMin} min</span>
        </span>
      </div>
    </div>
  );
}
