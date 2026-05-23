"use client";

import { useSearchParams } from "next/navigation";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useGuestSession } from "@/hooks/use-guest-session";
import { SplitBillView } from "@/components/guest/split-bill-view";

export function SplitPageClient({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const { tUI } = useAppLocale();
  const sessionToken = useGuestSession((s) => s.sessionToken);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  if (!sessionToken) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        {tUI("order.sessionMissing")}
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        {tUI("split.missingOrder")}
      </div>
    );
  }

  return (
    <SplitBillView
      slug={slug}
      token={token}
      orderId={orderId}
      sessionToken={sessionToken}
    />
  );
}
