"use client";

import { useGuestSession } from "@/hooks/use-guest-session";
import { OrderStatusTracker } from "@/components/guest/order-status-tracker";

export function OrderPageClient({
  slug,
  token,
  orderId,
  currency,
}: {
  slug: string;
  token: string;
  orderId: string;
  currency: string;
}) {
  const sessionToken = useGuestSession((s) => s.sessionToken);

  if (!sessionToken) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        Sesija nije pronađena. Skenirajte QR kod ponovo.
      </div>
    );
  }

  return (
    <OrderStatusTracker
      slug={slug}
      token={token}
      orderId={orderId}
      sessionToken={sessionToken}
      currency={currency}
    />
  );
}
