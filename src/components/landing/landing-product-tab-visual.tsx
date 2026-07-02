"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

function TabVisualSkeleton() {
  return (
    <div
      className={cn(
        "mx-auto aspect-[9/16] w-full max-w-[280px] animate-pulse rounded-[2rem]",
        "border border-[#dfe5ed] bg-[#fbfcfd]"
      )}
      aria-hidden
    />
  );
}

const LazyGuestMenuShowcase = dynamic(
  () =>
    import("@/components/landing/guest-menu-showcase").then((m) => ({
      default: m.GuestMenuShowcase,
    })),
  { loading: TabVisualSkeleton }
);

const LazyTablesShowcase = dynamic(
  () =>
    import("@/components/landing/tables-showcase").then((m) => ({
      default: m.TablesShowcase,
    })),
  { loading: TabVisualSkeleton }
);

const LazyKitchenShowcase = dynamic(
  () =>
    import("@/components/landing/kitchen-showcase").then((m) => ({
      default: m.KitchenShowcase,
    })),
  { loading: TabVisualSkeleton }
);

const LazyCheckoutShowcase = dynamic(
  () =>
    import("@/components/landing/checkout-showcase").then((m) => ({
      default: m.CheckoutShowcase,
    })),
  { loading: TabVisualSkeleton }
);

const LazyHistoryShowcase = dynamic(
  () =>
    import("@/components/landing/tables-showcase").then((m) => ({
      default: m.HistoryShowcase,
    })),
  { loading: TabVisualSkeleton }
);

const LazyAiShowcase = dynamic(
  () =>
    import("@/components/landing/ai-concierge-showcase").then((m) => ({
      default: m.AiConciergeShowcase,
    })),
  { loading: TabVisualSkeleton }
);

export type ProductTabId =
  | "guest"
  | "ai"
  | "floor"
  | "kitchen"
  | "payments"
  | "analytics";

export function LandingProductTabVisual({
  id,
  hideGuestLabel = true,
}: {
  id: ProductTabId;
  hideGuestLabel?: boolean;
}) {
  switch (id) {
    case "guest":
      return <LazyGuestMenuShowcase hideLabel={hideGuestLabel} />;
    case "ai":
      return <LazyAiShowcase hideLabel={hideGuestLabel} />;
    case "floor":
      return <LazyTablesShowcase />;
    case "kitchen":
      return <LazyKitchenShowcase />;
    case "payments":
      return <LazyCheckoutShowcase />;
    case "analytics":
      return <LazyHistoryShowcase />;
    default:
      return null;
  }
}
