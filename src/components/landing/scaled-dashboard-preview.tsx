"use client";

import { cn } from "@/lib/utils";
import { useContainerScale } from "@/components/landing/use-container-scale";

const DESIGN_WIDTH = 1120;

export function ScaledDashboardPreview({
  children,
  designHeight = 680,
  className,
  maxScale,
  fillWidth = true,
}: {
  children: React.ReactNode;
  designHeight?: number;
  className?: string;
  maxScale?: number;
  /** Scale to container width (landing surfaces). false = cap at 1× and center. */
  fillWidth?: boolean;
}) {
  const { containerRef, scale } = useContainerScale(DESIGN_WIDTH, {
    maxScale: maxScale ?? (fillWidth ? Infinity : 1),
  });
  const scaledHeight = designHeight * scale;
  const visualWidth = DESIGN_WIDTH * scale;

  return (
    <div ref={containerRef} className={cn("w-full overflow-hidden", className)}>
      <div
        className={cn(!fillWidth && "mx-auto")}
        style={{
          width: fillWidth ? "100%" : visualWidth,
          height: scaledHeight,
          overflow: "hidden",
        }}
      >
        <div
          className="pointer-events-none origin-top-left select-none"
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
