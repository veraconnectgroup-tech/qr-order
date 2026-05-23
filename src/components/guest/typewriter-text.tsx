"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function TypewriterText({
  text,
  active,
  speedMs = 30,
  className = "",
}: {
  text: string;
  active: boolean;
  speedMs?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(active && !reduceMotion ? "" : text);

  useEffect(() => {
    if (!active || reduceMotion) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [text, active, speedMs, reduceMotion]);

  return <span className={className}>{shown}</span>;
}
