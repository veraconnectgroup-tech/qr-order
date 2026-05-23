"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

function storageKey(orderId: string) {
  return `reviewed_order_${orderId}`;
}

export function GoogleReviewPrompt({
  orderId,
  googleReviewUrl,
  orderStatus,
}: {
  orderId: string;
  googleReviewUrl: string | null;
  orderStatus: string;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(storageKey(orderId)) === "1");
  }, [orderId]);

  const showReview =
    googleReviewUrl &&
    (orderStatus === "delivered" || orderStatus === "completed") &&
    !dismissed;

  if (!showReview) return null;

  function handleReviewClick() {
    localStorage.setItem(storageKey(orderId), "1");
    setDismissed(true);
    window.open(googleReviewUrl!, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="scheme-light mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
      <p className="text-center text-base font-medium text-zinc-900">
        Enjoyed your meal?
      </p>
      <Button
        type="button"
        onClick={handleReviewClick}
        className="mt-3 h-12 w-full rounded-xl border-0 bg-blue-600 text-base font-semibold text-white shadow-none hover:bg-blue-700"
      >
        <Star className="mr-2 size-4 fill-white" />
        Leave a Google Review
      </Button>
    </section>
  );
}
