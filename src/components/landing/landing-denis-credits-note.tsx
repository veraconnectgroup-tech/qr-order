"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/product-showcases";
import { denisAiCreditsMarketingEn } from "@/lib/constants";

/** ADR-009 F7 — Denis AI credits on public pricing (platform fee stays separate). */
export function LandingDenisCreditsNote() {
  const copy = denisAiCreditsMarketingEn();

  return (
    <AnimateInView className="mt-10">
      <div className="rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] p-8 shadow-[0_1px_2px_rgba(22,20,14,0.04)] sm:p-10">
        <p className="text-[13px] font-medium uppercase tracking-wider text-[var(--lp-subtle)]">
          Denis AI credits
        </p>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--lp-ink)]/80">
          Optional pay-as-you-go intelligence for guest concierge and staff
          copilot. Buy packs in Admin — no monthly AI subscription.
        </p>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <FeatureCheck light accent>{copy.starterLabel}</FeatureCheck>
          <FeatureCheck light accent>{copy.perTurn}</FeatureCheck>
          <FeatureCheck light accent>{copy.browseFree}</FeatureCheck>
          <FeatureCheck light accent>{copy.lowBalance}</FeatureCheck>
        </ul>
      </div>
    </AnimateInView>
  );
}
