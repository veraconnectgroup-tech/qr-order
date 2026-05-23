"use client";

import { cn } from "@/lib/utils";
import { useContainerScale } from "@/components/landing/use-container-scale";

const DESIGN_WIDTH = 1120;

export function ScaledDashboardPreview({
  children,
  designHeight = 680,
  className,
}: {
  children: React.ReactNode;
  designHeight?: number;
  className?: string;
}) {
  const { containerRef, scale } = useContainerScale(DESIGN_WIDTH, {
    maxScale: 1,
  });
  const scaledHeight = designHeight * scale;

  return (
    <div ref={containerRef} className={cn("w-full overflow-hidden", className)}>
      <div style={{ height: scaledHeight }}>
        <div
          className="pointer-events-none select-none origin-top-left"
          style={{
            width: DESIGN_WIDTH,
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
