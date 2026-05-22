"use client";

import { useGuestSession } from "@/hooks/use-guest-session";
import { OrderStatusTracker } from "@/components/guest/order-status-tracker";

export function OrderPageClient({
  slug,
  token,
  orderId,
  currency,
  stripeOnboarded,
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
}: {
  slug: string;
  token: string;
  orderId: string;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
}) {
  const sessionToken = useGuestSession((s) => s.sessionToken);

  if (!sessionToken) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        Session not found. Please scan the QR code again.
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
      stripeOnboarded={stripeOnboarded}
      paymentOnlineEnabled={paymentOnlineEnabled}
      paymentAtBarEnabled={paymentAtBarEnabled}
      paymentCardAtTableEnabled={paymentCardAtTableEnabled}
    />
  );
}
