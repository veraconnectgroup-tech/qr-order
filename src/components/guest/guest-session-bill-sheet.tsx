"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { OrderBillPanel } from "@/components/guest/order-bill-panel";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function GuestSessionBillSheet({
  open,
  onOpenChange,
  slug,
  token,
  sessionToken,
  currency,
  stripeOnboarded,
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
  inPersonPaymentLocation = "bar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  token: string;
  sessionToken: string;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
}) {
  const { tUI } = useAppLocale();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,var(--denis-vv-height,100dvh))] overflow-y-auto rounded-t-2xl border-[var(--qr-elevated)] bg-[var(--qr-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-start">
          <SheetTitle className="text-[var(--qr-ivory)]">
            {tUI("scene.action.viewBill")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <OrderBillPanel
            token={token}
            sessionToken={sessionToken}
            currency={currency}
            stripeOnboarded={stripeOnboarded}
            paymentOnlineEnabled={paymentOnlineEnabled}
            paymentAtBarEnabled={paymentAtBarEnabled}
            paymentCardAtTableEnabled={paymentCardAtTableEnabled}
            inPersonPaymentLocation={inPersonPaymentLocation}
            isPaid={false}
            slug={slug}
            onPaid={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
