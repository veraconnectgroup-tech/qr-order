"use client";

import { cn } from "@/lib/utils";
import { useContainerScale } from "@/components/landing/use-container-scale";

const DEFAULT_DESIGN_WIDTH = 300;

export function ScaledPhonePreview({
  children,
  designWidth = DEFAULT_DESIGN_WIDTH,
  designHeight = 560,
  className,
}: {
  children: React.ReactNode;
  designWidth?: number;
  designHeight?: number;
  className?: string;
}) {
  const { containerRef, scale } = useContainerScale(designWidth);
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
