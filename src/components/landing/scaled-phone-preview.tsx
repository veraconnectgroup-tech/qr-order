"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DESIGN_WIDTH = 300;

export function ScaledPhonePreview({
  children,
  designWidth = DESIGN_WIDTH,
  designHeight = 560,
  className,
}: {
  children: React.ReactNode;
  designWidth?: number;
  designHeight?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      setScale(width / designWidth);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);

  const scaledHeight = designHeight * scale;

  return (
    <div ref={containerRef} className={cn("w-full overflow-hidden", className)}>
      <div style={{ height: scaledHeight }}>
        <div
          className="pointer-events-none select-none origin-top-left"
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
