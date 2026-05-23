"use client";

import { Suspense } from "react";
import type { InPersonPaymentLocation } from "@/lib/constants";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useGuestSessionToken } from "@/hooks/use-guest-session-token";
import { OrderStatusTracker } from "@/components/guest/order-status-tracker";

export function OrderPageClient({
  slug,
  token,
  orderId,
  locationId,
  currency,
  stripeOnboarded,
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
  googleReviewUrl,
  inPersonPaymentLocation,
}: {
  slug: string;
  token: string;
  orderId: string;
  locationId: string;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
  googleReviewUrl: string | null;
  inPersonPaymentLocation: InPersonPaymentLocation;
}) {
  const { tUI } = useAppLocale();
  const { sessionToken, hydrated } = useGuestSessionToken();

  if (!hydrated) {
    return (
      <div className="space-y-4 px-4 py-6">
        <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
        <div className="mx-auto h-12 w-24 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-52 w-full animate-pulse rounded-xl bg-zinc-800" />
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        {tUI("order.sessionMissing")}
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-4 px-4 py-6">
          <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
          <div className="mx-auto h-12 w-24 animate-pulse rounded-lg bg-zinc-800" />
          <div className="h-52 w-full animate-pulse rounded-xl bg-zinc-800" />
        </div>
      }
    >
      <OrderStatusTracker
        slug={slug}
        token={token}
        orderId={orderId}
        sessionToken={sessionToken}
        locationId={locationId}
        currency={currency}
        stripeOnboarded={stripeOnboarded}
        paymentOnlineEnabled={paymentOnlineEnabled}
        paymentAtBarEnabled={paymentAtBarEnabled}
        paymentCardAtTableEnabled={paymentCardAtTableEnabled}
        googleReviewUrl={googleReviewUrl}
        inPersonPaymentLocation={inPersonPaymentLocation}
      />
    </Suspense>
  );
}
