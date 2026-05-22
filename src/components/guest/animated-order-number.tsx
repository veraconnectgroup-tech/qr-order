"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedOrderNumber({ orderNumber }: { orderNumber: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(orderNumber * easeOutCubic(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [orderNumber]);

  return (
    <motion.p
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 12 }}
      className="font-mono text-6xl font-bold text-orange-500"
    >
      #{String(display).padStart(3, "0")}
    </motion.p>
  );
}
