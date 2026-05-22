"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { SoundToggle } from "@/components/dashboard/sound-toggle";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

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
    <span className="font-mono text-xl tabular-nums text-zinc-100">{time}</span>
  );
}

export function KitchenHeader() {
  const { orgName } = useDashboard();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <p className="truncate text-sm font-semibold text-zinc-300">{orgName}</p>
      <LiveClock />
      <div className="flex items-center gap-2">
        <SoundToggle />
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Exit Kitchen
        </Link>
      </div>
    </header>
  );
}
