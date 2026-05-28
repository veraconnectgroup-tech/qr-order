"use client";

import { GuestProductRow } from "@/components/design-system/guest-product-row";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { Scene } from "@/lib/scene/types";
import { sceneInlineLayers } from "@/lib/scene/layer-utils";
import { cn } from "@/lib/utils";

export function DenisSceneInlineRecommendations({
  scene,
  currency,
  onAdd,
  embedded = false,
}: {
  scene: Scene;
  currency: string;
  onAdd: (productId: string) => void;
  embedded?: boolean;
}) {
  const { tUI } = useAppLocale();
  const inlineLayers = sceneInlineLayers(scene);
  if (!inlineLayers.length) return null;

  return (
    <div
      className={cn(
        !embedded &&
          "mx-4 mb-4 overflow-hidden rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)]"
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--qr-elevated)]/80 px-4 py-2.5">
        <DenisMarkBadge size="sm" />
        <p className="text-xs font-semibold text-[var(--qr-ivory)]">
          {tUI("scene.inline.title")}
        </p>
      </div>
      <div className="divide-y divide-[var(--qr-elevated)]/80 px-1">
        {inlineLayers.map((item) => (
          <GuestProductRow
            key={item.productId}
            name={item.name}
            price={item.priceCents != null ? item.priceCents / 100 : 0}
            currency={currency}
            subtitle={item.reason ?? tUI("scene.inline.reasonFallback")}
            density="compact"
            addStyle="icon"
            addAriaLabel={tUI("scene.inline.add", { name: item.name })}
            onAdd={() => onAdd(item.productId)}
          />
        ))}
      </div>
    </div>
  );
}
