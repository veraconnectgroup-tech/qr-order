"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/product-showcases";
import { denisAiCreditsMarketingEn } from "@/lib/constants";

/** ADR-009 F7 — Denis AI credits on public pricing (platform fee stays separate). */
export function LandingDenisCreditsNote() {
  const copy = denisAiCreditsMarketingEn();

  return (
    <AnimateInView className="mt-10">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10">
        <p className="text-[13px] font-medium uppercase tracking-wider text-zinc-500">
          Denis AI credits
        </p>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
          Optional pay-as-you-go intelligence for guest concierge and staff
          copilot. Buy packs in Admin — no monthly AI subscription.
        </p>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <FeatureCheck accent>{copy.starterLabel}</FeatureCheck>
          <FeatureCheck accent>{copy.perTurn}</FeatureCheck>
          <FeatureCheck accent>{copy.browseFree}</FeatureCheck>
          <FeatureCheck accent>{copy.lowBalance}</FeatureCheck>
        </ul>
      </div>
    </AnimateInView>
  );
}
