"use client";

import { useEffect, useState } from "react";

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
  const [shown, setShown] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
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
  }, [text, active, speedMs]);

  return <span className={className}>{shown}</span>;
}
