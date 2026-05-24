"use client";

import Link from "next/link";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function TrialBanner() {
  const {
    trialEndsAt,
    subscriptionStatus,
    onboardingCompleted,
    staffRole,
  } = useDashboard();

  if (!onboardingCompleted) return null;
  if (!["owner", "manager"].includes(staffRole)) return null;
  if (subscriptionStatus === "active") return null;

  const daysLeft = trialDaysLeft(trialEndsAt);
  const trialing = subscriptionStatus === "trialing";
  const trialExpired = daysLeft !== null && daysLeft <= 0;
  const trialEndingSoon =
    trialing && daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
  const needsPlan =
    trialExpired ||
    subscriptionStatus === "past_due" ||
    subscriptionStatus === "unpaid" ||
    subscriptionStatus === "canceled";

  if (!trialEndingSoon && !needsPlan) return null;

  if (needsPlan) {
    return (
      <div
        role="region"
        aria-label="Testphase abgelaufen"
        className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-200"
      >
        Ihre Testphase ist abgelaufen. Bitte wählen Sie einen Plan.{" "}
        <Link
          href="/dashboard/billing"
          className="font-semibold underline underline-offset-2"
        >
          Pläne ansehen
        </Link>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Testphase endet bald"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100"
    >
      Ihre Testphase endet in {daysLeft} Tag{daysLeft === 1 ? "" : "en"}. Wählen
      Sie einen Plan.{" "}
      <Link
        href="/dashboard/billing"
        className="font-semibold underline underline-offset-2"
      >
        Pläne ansehen
      </Link>
    </div>
  );
}
