"use client";

import Link from "next/link";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  buildTrialEndingGuestMessage,
  isTrialing,
  trialDaysLeft,
} from "@/lib/billing/trial";

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
  const trialing = isTrialing(subscriptionStatus);
  const trialExpired = daysLeft !== null && daysLeft <= 0;
  const trialEndingSoon =
    trialing && daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
  const trialCritical =
    trialing && daysLeft !== null && daysLeft > 0 && daysLeft <= 3;
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
        aria-label="Trial expired"
        className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-200"
      >
        Your trial has expired. Choose a plan to continue.{" "}
        <Link
          href="/dashboard/billing"
          className="font-semibold underline underline-offset-2"
        >
          View plans
        </Link>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Trial ending soon"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100"
    >
      {trialCritical && daysLeft != null
        ? buildTrialEndingGuestMessage(daysLeft)
        : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`}{" "}
      <Link
        href="/dashboard/billing"
        className="font-semibold underline underline-offset-2"
      >
        Upgrade
      </Link>
    </div>
  );
}
