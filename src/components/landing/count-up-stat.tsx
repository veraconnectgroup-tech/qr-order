"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUpStat({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  label,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();

  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl font-bold text-orange-500">
        {prefix}
        {formatted}
        {suffix}
      </p>
      <p className="mt-1 text-sm text-zinc-400">{label}</p>
    </div>
  );
}

export function StatText({
  display,
  label,
}: {
  display: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (inView) setShown(true);
  }, [inView]);

  return (
    <div ref={ref} className="text-center">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={shown ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-4xl font-bold text-orange-500"
      >
        {display}
      </motion.p>
      <p className="mt-1 text-sm text-zinc-400">{label}</p>
    </div>
  );
}
