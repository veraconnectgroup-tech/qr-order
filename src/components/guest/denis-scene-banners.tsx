"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { SceneBannerLayer } from "@/lib/scene/layer-utils";
import { hapticClick } from "@/lib/haptics";
import { cn } from "@/lib/utils";

function useDismissedIds() {
  const ref = useRef(new Set<string>());
  const [, bump] = useState(0);
  return {
    isDismissed: (id: string) => ref.current.has(id),
    dismiss: (id: string) => {
      ref.current.add(id);
      bump((n) => n + 1);
    },
  };
}

export function DenisSceneBanners({
  banners,
  onBannerAction,
  onDismiss,
}: {
  banners: SceneBannerLayer[];
  onBannerAction: (banner: SceneBannerLayer) => void;
  onDismiss: (bannerId: string) => void;
}) {
  const { tUI } = useAppLocale();
  const dismissed = useDismissedIds();
  const visible = banners.filter((banner) => !dismissed.isDismissed(banner.id));

  function bannerMessage(banner: SceneBannerLayer) {
    if (banner.id.startsWith("order-placed-") && banner.message.startsWith("#")) {
      return tUI("scene.banner.orderPlaced", {
        number: banner.message.slice(1),
      });
    }
    return banner.message;
  }

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pb-2">
      {visible.map((banner) => (
        <div
          key={banner.id}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (banner.action === "add_product") return;
            hapticClick();
            onBannerAction(banner);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (banner.action === "add_product") return;
              onBannerAction(banner);
            }
          }}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-[var(--denis-chip-border)] bg-[var(--qr-surface)] px-4 py-3",
            banner.action !== "add_product" && "cursor-pointer active:scale-[0.99]"
          )}
        >
          <DenisMarkBadge size="md" />
          <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--qr-ivory)]">
            {bannerMessage(banner)}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissed.dismiss(banner.id);
              onDismiss(banner.id);
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--qr-muted)] transition hover:bg-[var(--qr-elevated)] hover:text-[var(--qr-ivory)]"
            aria-label={tUI("ai.proactive.dismiss")}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
